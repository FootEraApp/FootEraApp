/** Teste de reembolso TOTAL de bundle contendo somente metodologias avulsas.
 *  Executar SOMENTE contra footera_billing_qa, com API em modo fake.
 */
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const {PrismaClient} = require('@prisma/client');
dotenv.config({path:path.join(process.cwd(),'server','.env.development'),quiet:true});
const db = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost','127.0.0.1'].includes(db.hostname) || db.port!=='5433' || db.pathname!=='/footera_billing_qa' || process.env.NODE_ENV==='production' || process.env.MP_ACCESS_TOKEN || process.env.BILLING_CUPOM_RESERVA_QA!=='true' || process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS!=='true') throw Error('SEGURANÇA: somente localhost:5433/footera_billing_qa, fake, flags QA ativas');
const api=process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['http://127.0.0.1:3001','http://localhost:3001'].includes(api) || !process.env.JWT_SECRET || !process.env.BILLING_WEBHOOK_SECRET) throw Error('API local e segredos de QA obrigatórios');
const prisma=new PrismaClient();
const run=`qa-refund-bundle-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let pass=0,fail=0;
const check=(condition,desc,detail='')=>{console.log(`${condition?'✔':'✖'} ${desc}${detail?' — '+detail:''}`);condition?pass++:fail++};
const must=(condition,desc)=>{if(!condition)throw Error(`TESTE INTERROMPIDO: ${desc}`)};
const cents=(x)=>Math.round(Number(x)*100);
async function post(endpoint,body,headers={}){const r=await fetch(`${api}/api/billing/${endpoint}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:r.status,body:await r.json().catch(()=>({}))};}
async function main(){
 console.log('Banco QA:',db.host+db.pathname,'|',run);
 const buyer=await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},verified:true,deletedAt:null,atleta:{isNot:null}},orderBy:{dataCriacao:'desc'}});
 must(buyer,'comprador QA verificado ausente');
 const token=jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'});
 const auth={authorization:`Bearer ${token}`};
 const payer={nome:'Comprador QA',email:`buyer-${run}@qa.invalid`};
 async function webhook(tipo,pagamento,id){return post('webhook/provider',{provider:'INTERNAL_FAKE',providerEventId:`${run}:${id}`,tipo,data:{pagamentoId:pagamento.id}},{'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET})}
 const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator Bundle QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
 await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
 const makeCourse=(s,price)=>prisma.metodologiaAvulsa.create({data:{titulo:`QA bundle refund ${s} ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:price}});
 const [a,b]=await Promise.all([makeCourse('A','23.00'),makeCourse('B','37.00')]);
 const item=(c)=>({planoId:`METODOLOGIA_AVULSA:${c.id}`,periodicidade:'Mensal'});
 const single=await post('checkout',{...item(a),metodo:'PIX',pagador:payer},auth);
 must(single.status===200 && single.body?.pagamento?.id,'checkout individual válido de A');
 const pgSingle=await prisma.pagamento.findUnique({where:{id:single.body.pagamento.id}});
 must(pgSingle?.provider==='INTERNAL_FAKE' && (await webhook('payment_approved',pgSingle,'approve-single')).status===200,'pagamento único A aprovado em fake QA');
 // Cupom percentual congelado no snapshot do bundle.
 const cupom=await prisma.cupom.create({data:{codigo:`${run}-cupom`,tipo:'PERCENTUAL',descontoPerc:10,ativo:true,usosMax:1,usosAtuais:0}});
 const checkout=await post('checkout-bundle',{items:[item(a),item(b)],metodo:'PIX',cupom:cupom.codigo,pagador:payer},auth);
 must(checkout.status===200 && checkout.body?.pagamento?.id,`checkout bundle HTTP ${checkout.status}: ${JSON.stringify(checkout.body).slice(0,400)}`);
 const pg=await prisma.pagamento.findUnique({where:{id:checkout.body.pagamento.id}});
 must(pg?.provider==='INTERNAL_FAKE' && pg.status==='PENDENTE','backend está no mesmo banco QA fake');
 const snapshot=pg.meta?.financeiroV1;
 must(snapshot?.versao===1 && snapshot.items?.length===2,'snapshot financeiro bundle ausente');
 check(snapshot.totalCentavos===5400 && snapshot.items.reduce((s,i)=>s+i.valorFinalCentavos,0)===5400,'Bundle com desconto rateado e congelado');
 const approved=await webhook('payment_approved',pg,'approve-bundle');
 must(approved.status===200,`aprovação bundle falhou HTTP ${approved.status}: ${JSON.stringify(approved.body)}`);
 const preBen=await prisma.pagamentoBeneficio.findMany({where:{pagamentoId:pg.id}});
 const preVendas=await prisma.creatorVenda.findMany({where:{pagamentoId:pg.id}});
 must(preBen.length===2 && preVendas.length===2,'aprovação não provisionou as duas linhas');
 check(preVendas.reduce((s,v)=>s+cents(v.valorBruto),0)===5400,'Vendas totalizam o snapshot líquido do bundle');
 const refund=await webhook('payment_refunded',pg,'refund-bundle');
 const afterPg=await prisma.pagamento.findUnique({where:{id:pg.id}});
 const afterBen=await prisma.pagamentoBeneficio.findMany({where:{pagamentoId:pg.id}});
 const afterSales=await prisma.creatorVenda.findMany({where:{pagamentoId:pg.id}});
 const accessA=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:a.id,usuarioId:buyer.id}}});
 const accessB=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:b.id,usuarioId:buyer.id}}});
 check(refund.status===200 && afterPg?.status==='REEMBOLSADO','Bundle reembolsado integralmente',`HTTP ${refund.status} ${JSON.stringify(refund.body).slice(0,150)}`);
 check(afterBen.length===2 && afterBen.every(b=>b.revogadoEm),'Ambos benefícios do bundle revogados');
 check(afterSales.length===2 && afterSales.every(v=>v.status==='REEMBOLSADA'),'Ambas vendas Creator reembolsadas');
 check(accessA?.status==='ATIVA','Compra individual anterior sustenta acesso A');
 check(accessB?.status==='CANCELADA','Acesso exclusivo B foi cancelado');
 const cupomDepois=await prisma.cupom.findUnique({where:{id:cupom.id}});
 const resgate=await prisma.cupomResgate.findUnique({where:{cupomId_usuarioId:{cupomId:cupom.id,usuarioId:buyer.id}}});
 check(cupomDepois?.usosAtuais===1 && !!resgate,'Cupom mantém uso histórico após reembolso');
 const again=await webhook('payment_refunded',pg,'refund-bundle-another-event');
 const againBen=await prisma.pagamentoBeneficio.findMany({where:{pagamentoId:pg.id}});
 check(again.status===200 && againBen.every(b=>afterBen.find(x=>x.id===b.id)?.revogadoEm?.getTime()===b.revogadoEm?.getTime()),'Reembolso repetido não modifica datas de revogação');
 const remaining=await prisma.creatorVenda.findMany({where:{pagamentoId:pgSingle.id}});
 check(remaining.length===1 && remaining[0].status==='CONFIRMADA','Venda da compra independente continua confirmada');
 // NEGATIVOS: cada cenário usa metodologias exclusivas para não afetar os testes anteriores.
 async function montarBundleNegativo(rotulo) {
   const [x,y]=await Promise.all([
     makeCourse(`${rotulo}-X`,'21.00'),makeCourse(`${rotulo}-Y`,'29.00')
   ]);
   const checkoutNeg=await post('checkout-bundle',{
     items:[item(x),item(y)],metodo:'PIX',pagador:payer
   },auth);
   must(checkoutNeg.status===200 && checkoutNeg.body?.pagamento?.id,
     `checkout negativo ${rotulo}: HTTP ${checkoutNeg.status}`);
   const pagamento=await prisma.pagamento.findUnique({where:{id:checkoutNeg.body.pagamento.id}});
   must(pagamento?.provider==='INTERNAL_FAKE',`provider negativo ${rotulo} não é fake`);
   const aprovado=await webhook('payment_approved',pagamento,`neg-${rotulo}-approve`);
   must(aprovado.status===200,`aprovação negativo ${rotulo}: HTTP ${aprovado.status}`);
   must((await prisma.pagamentoBeneficio.count({where:{pagamentoId:pagamento.id}}))===2,
     `benefícios do negativo ${rotulo} ausentes`);
   must((await prisma.creatorVenda.count({where:{pagamentoId:pagamento.id}}))===2,
     `vendas do negativo ${rotulo} ausentes`);
   return {pagamento,x,y};
 }
 async function estadoImutavel(pgId) {
   const [pagamento,beneficios,vendas]=await Promise.all([
     prisma.pagamento.findUnique({where:{id:pgId}}),
     prisma.pagamentoBeneficio.findMany({where:{pagamentoId:pgId}}),
     prisma.creatorVenda.findMany({where:{pagamentoId:pgId}}),
   ]);
   return (
    pagamento?.status === "APROVADO" &&
    beneficios.length === 2 &&
    beneficios.every(
      (b) => b.revogadoEm === null
    ) &&
    vendas.length >= 1 &&
    vendas.every(
      (v) => v.status === "CONFIRMADA"
    )
  );
 }
 // Caso 1: um dos itens não tem venda Creator. Deve recusar tudo sem mutação.
 const faltante=await montarBundleNegativo('venda-ausente');
 const vendasFaltante=await prisma.creatorVenda.findMany({
   where:{pagamentoId:faltante.pagamento.id},orderBy:{id:'asc'}
 });
 await prisma.creatorVenda.delete({where:{id:vendasFaltante[0].id}});
 const erroVenda=await webhook('payment_refunded',faltante.pagamento,'neg-venda-ausente-refund');
 check(erroVenda.status===503 && await estadoImutavel(faltante.pagamento.id) &&
   (await prisma.creatorVenda.count({where:{pagamentoId:faltante.pagamento.id}}))===1,
   'Venda ausente: HTTP 503 e nenhuma revogação',`HTTP ${erroVenda.status}`);
 // Caso 2: snapshot financeiro alterado depois da aprovação. Deve recusar sem mutação.
 const corrompido=await montarBundleNegativo('snapshot-invalido');
 const financeiroOriginal=corrompido.pagamento.meta;
 const metaCorrompido={...financeiroOriginal,
   financeiroV1:{...financeiroOriginal.financeiroV1,
     totalCentavos: financeiroOriginal.financeiroV1.totalCentavos+1}};
 await prisma.pagamento.update({where:{id:corrompido.pagamento.id},
   data:{meta:metaCorrompido}});
 const erroSnapshot=await webhook('payment_refunded',corrompido.pagamento,'neg-snapshot-refund');
 check(erroSnapshot.status===503 && await estadoImutavel(corrompido.pagamento.id) &&
   (await prisma.creatorVenda.count({where:{pagamentoId:corrompido.pagamento.id}}))===2,
   'Snapshot inválido: HTTP 503 e nenhuma revogação',`HTTP ${erroSnapshot.status}`);
 console.log(`\nRESULTADO: ${pass}/${pass+fail} verificações aprovadas. Banco footera_billing_qa.`);
 if(fail)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
