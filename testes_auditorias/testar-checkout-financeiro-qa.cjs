/** Teste do checkout HTTP real e snapshot financeiro. NUNCA executar fora do QA local. */
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
dotenv.config({ path: path.join(process.cwd(), 'server', '.env.development'), quiet: true });
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['127.0.0.1','localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/footera_billing_qa') throw Error('SEGURANÇA: banco deve ser localhost:5433/footera_billing_qa');
const api = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['http://127.0.0.1:3001','http://localhost:3001'].includes(api)) throw Error('SEGURANÇA: API deve ser localhost:3001');
if (!process.env.JWT_SECRET || !process.env.BILLING_WEBHOOK_SECRET) throw Error('JWT_SECRET e BILLING_WEBHOOK_SECRET são obrigatórios');
if (process.env.MP_ACCESS_TOKEN) throw Error('SEGURANÇA: desative MP_ACCESS_TOKEN no teste e no backend QA; não usamos gateway real');
const prisma = new PrismaClient();
const run = `qa-checkout-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let ok = 0, fail = 0;
const report = (yes, name, more = '') => { console.log(`${yes?'✔':'✖'} ${name}${more?' — '+more:''}`); yes ? ok++ : fail++; };
const money = x => Math.round(Number(x)*100);
async function post(urlPath, obj, headers = {}) {
  const res = await fetch(`${api}/api/billing/${urlPath}`, { method:'POST', headers:{'content-type':'application/json',...headers},body:JSON.stringify(obj),signal:AbortSignal.timeout(20000) });
  return { status:res.status, body:await res.json().catch(()=>({})) };
}
async function main() {
  console.log('Banco:',url.host+url.pathname,'| Execução:',run);
  const buyer=await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},deletedAt:null,verified:true},orderBy:{dataCriacao:'desc'}});
  if (!buyer) throw Error('Não há comprador qa_rec_atleta_* verificado no QA. Não modificamos contas automaticamente.');
  const athlete=await prisma.atleta.findUnique({where:{usuarioId:buyer.id}});
  if (!athlete) throw Error('Comprador QA não tem perfil Atleta');
  const token=jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'});
  const auth={authorization:`Bearer ${token}`};
  const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
  const creator=await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
  const createCourse=async (suffix,price) => prisma.metodologiaAvulsa.create({data:{titulo:`QA financeiro ${suffix} ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:price}});
  const one=await createCourse('um','20.00');
  const two=await createCourse('dois','30.00');
  const payer={nome:'Comprador QA',email:`comprador-${run}@qa.invalid`};
  const item=x=>({planoId:`METODOLOGIA_AVULSA:${x.id}`,periodicidade:'Mensal'});
  async function checkout(endpoint,payload,n) {
    const response=await post(endpoint,{...payload,metodo:'PIX',pagador:payer},auth);
    const id=response.body?.pagamento?.id;
    if (!id) throw Error(`Checkout ${n} falhou: HTTP ${response.status}: ${JSON.stringify(response.body).slice(0,1000)}`);
    const payment=await prisma.pagamento.findUnique({where:{id}});
    if (!payment) throw Error(`Checkout ${n} não existe no banco QA. Backend pode estar conectado a OUTRO banco. ABORTADO.`);
    if (payment.provider!=='INTERNAL_FAKE') throw Error(`PROVIDER NÃO FAKE (${payment.provider}). ABORTADO: confira MP_ACCESS_TOKEN no backend QA`);
    report(response.status===200 && response.body.status==='PENDENTE',`Checkout HTTP ${n}`,`HTTP ${response.status}`);
    const f=payment.meta?.financeiroV1;
    report(f?.versao===1 && Array.isArray(f?.items),`Snapshot financeiro ${n}`,`linhas=${f?.items?.length ?? 0}`);
    report(f?.totalCentavos===money(payment.valor) && f?.items?.reduce((a,i)=>a+i.valorFinalCentavos,0)===money(payment.valor),`Fechamento em centavos ${n}`,`R$ ${payment.valor}`);
    return {payment,f};
  }
  async function approve(pg,suffix) {
    const response=await fetch(`${api}/api/billing/webhook/provider`,{method:'POST',headers:{'content-type':'application/json','x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET},body:JSON.stringify({
      provider: 'INTERNAL_FAKE',
      providerEventId: `${run}:${suffix}`,
      tipo: 'payment_approved',
      data: { pagamentoId: pg.id },
    }),signal:AbortSignal.timeout(20000)});
    const body=await response.json().catch(()=>({}));
    report(response.status===200,`Aprovação ${suffix}`,`HTTP ${response.status}`);
    if(response.status!==200) throw Error(`Aprovação ${suffix} falhou: ${JSON.stringify(body).slice(0,1000)}`);
  }
  const single=await checkout('checkout',{...item(one)},'individual');
  report(single.f?.items?.length===1 && single.f.items[0].valorFinalCentavos===2000,'Preço original congelado','R$ 20,00');
  await prisma.metodologiaAvulsa.update({where:{id:one.id},data:{precoAssinaturaMensal:'67.00'}});
  await approve(single.payment,'individual');
  const sale=await prisma.creatorVenda.findFirst({where:{pagamentoId:single.payment.id}});
  report(sale?.creatorId===creator.id && money(sale.valorBruto)===2000,'Venda permanece no preço do checkout',`R$ ${sale?.valorBruto ?? 'ausente'}`);
  const bundle=await checkout('checkout-bundle',{items:[item(one),item(two)]},'pacote');
  report(bundle.f?.items?.length===2 && bundle.f.items[0].valorFinalCentavos===6700 && bundle.f.items[1].valorFinalCentavos===3000,'Pacote registra dois valores distintos');
  await prisma.metodologiaAvulsa.update({where:{id:one.id},data:{precoAssinaturaMensal:'99.00'}});
  await prisma.metodologiaAvulsa.update({where:{id:two.id},data:{precoAssinaturaMensal:'88.00'}});
  await approve(bundle.payment,'bundle');
  const sales=await prisma.creatorVenda.findMany({where:{pagamentoId:bundle.payment.id}});
  const sums=new Map(sales.map(s=>[s.metodologiaAvulsaId,money(s.valorBruto)]));
  report(sales.length===2 && sums.get(one.id)===6700 && sums.get(two.id)===3000,'Bundle mantém valores anteriores à mudança de catálogo',`vendas=${sales.length}`);
  const repeat=await fetch(`${api}/api/billing/webhook/provider`,{method:'POST',headers:{'content-type':'application/json','x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET},body:JSON.stringify({
    provider: 'INTERNAL_FAKE',
    providerEventId: `${run}:bundle`,
    tipo: 'payment_approved',
    data: { pagamentoId: bundle.payment.id },
  })});
  report(repeat.status===200 && (await prisma.creatorVenda.count({where:{pagamentoId:bundle.payment.id}}))===2,'Webhook repetido sem duplicação',`HTTP ${repeat.status}`);

  // Teste adicional: cupom individual reservado, consumido e idempotente.
  const codigoIndividual = `${run}-individual-limitado`;
  const cupomIndividual = await prisma.cupom.create({
    data: { codigo: codigoIndividual, tipo: 'PERCENTUAL', descontoPerc: 10,
      ativo: true, usosMax: 1, usosAtuais: 0 },
  });
  const individualPayload = { ...item(two), metodo:'PIX', cupom:codigoIndividual, pagador:payer };
  const primeiraTentativa = await post('checkout', individualPayload, auth);
  const pgId = primeiraTentativa.body?.pagamento?.id;
  report(primeiraTentativa.status===200 && primeiraTentativa.body?.status==='PENDENTE' && Boolean(pgId),
    'Cupom individual limitado — checkout', `HTTP ${primeiraTentativa.status}`);
  if (!pgId) throw Error('Checkout individual com cupom sem pagamento: '+JSON.stringify(primeiraTentativa.body));
  const pgCupom = await prisma.pagamento.findUnique({where:{id:pgId}});
  if (!pgCupom || pgCupom.provider!=='INTERNAL_FAKE') throw Error('Pagamento com cupom não localizado no banco QA ou não fake. ABORTADO.');
  const reservaAntes = await prisma.cupomReserva.findUnique({where:{pagamentoId:pgId}});
  const usosAntes = await prisma.cupom.findUnique({where:{id:cupomIndividual.id}});
  report(pgCupom.cupomId===cupomIndividual.id && money(pgCupom.valor)===7920 &&
    pgCupom.meta?.financeiroV1?.totalCentavos===7920,
    'Cupom individual — valor e snapshot preservados', `R$ ${pgCupom.valor}`);
  report(reservaAntes?.status==='RESERVADA' && reservaAntes.cupomId===cupomIndividual.id &&
    reservaAntes.usuarioId===buyer.id && usosAntes?.usosAtuais===0,
    'Cupom individual — reservado sem consumo');
  const segundaTentativa = await post('checkout',individualPayload,auth);
  const pagamentosAntesAprovacao = await prisma.pagamento.count({where:{cupomId:cupomIndividual.id}});
  report(segundaTentativa.status===409 && !segundaTentativa.body?.pagamento?.id && pagamentosAntesAprovacao===1,
    'Cupom individual — segunda compra recusada sem novo pagamento',`HTTP ${segundaTentativa.status}`);
  await approve(pgCupom,'individual-cupom');
  const reservaDepois = await prisma.cupomReserva.findUnique({where:{pagamentoId:pgId}});
  const cupomDepois = await prisma.cupom.findUnique({where:{id:cupomIndividual.id}});
  const resgateDepois = await prisma.cupomResgate.findUnique({where:{cupomId_usuarioId:{cupomId:cupomIndividual.id,usuarioId:buyer.id}}});
  report(reservaDepois?.status==='CONSUMIDA' && reservaDepois.consumidaEm!==null &&
    cupomDepois?.usosAtuais===1 && resgateDepois?.pagamentoId===pgId,
    'Cupom individual — reserva consumida na aprovação');
  const vendasAntesRepeticao = await prisma.creatorVenda.count({where:{pagamentoId:pgId}});
  const repetido = await post('webhook/provider',{
    provider:'INTERNAL_FAKE', providerEventId:`${run}:individual-cupom`,
    tipo:'payment_approved',data:{pagamentoId:pgId}
  },{'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET});
  const vendasDepoisRepeticao = await prisma.creatorVenda.count({where:{pagamentoId:pgId}});
  const cupomDepoisRepeticao = await prisma.cupom.findUnique({where:{id:cupomIndividual.id}});
  report(repetido.status===200 && vendasAntesRepeticao===1 && vendasDepoisRepeticao===1 && cupomDepoisRepeticao?.usosAtuais===1,
    'Cupom individual — reentrega idempotente',`HTTP ${repetido.status}`);
  console.log(`\nRESULTADO: ${ok}/${ok+fail} verificações aprovadas.`);
  if(fail) process.exitCode=1;
}
main().catch(e=>{console.error('\nTESTE INTERROMPIDO:',e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
