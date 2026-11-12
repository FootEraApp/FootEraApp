/** Testes isolados de CreatorVenda: executar somente em footera_billing_qa. */
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
dotenv.config({ path: path.join(process.cwd(), 'server', '.env.development'), quiet: true });
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5433' || url.pathname !== '/footera_billing_qa') {
  throw Error('SEGURANÇA: DATABASE_URL deve apontar para 127.0.0.1:5433/footera_billing_qa');
}
const api = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['http://127.0.0.1:3001', 'http://localhost:3001'].includes(api)) throw Error('API QA inválida');
const secret = process.env.BILLING_WEBHOOK_SECRET;
if (!secret) throw Error('BILLING_WEBHOOK_SECRET ausente');
const prisma = new PrismaClient();
const run = `qa-creator-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let pass = 0, fail = 0;
function check(ok, name, extra='') { console.log(`${ok ? '✔' : '✖'} ${name}${extra ? ' — '+extra : ''}`); ok ? pass++ : fail++; }
async function webhook(payment, suffix) {
 const res = await fetch(`${api}/api/billing/webhook/provider`, { method:'POST', headers:{'content-type':'application/json','x-webhook-secret':secret}, body:JSON.stringify({provider:'QA_SIMULADO',providerEventId:`${run}:${suffix}`,tipo:'payment_approved',data:{pagamentoId:payment.id}}), signal:AbortSignal.timeout(20000) });
 return {status:res.status, body:await res.json().catch(()=>({}))};
}
async function createPayment(buyer, perfil, plano, amount, suffix, bundleItems=null) {
 return prisma.pagamento.create({ data:{ usuarioId:buyer.id, contextoKind:'PERSONAL', contextoTipo:'Atleta', contextoPerfilId:perfil.id, plano, periodicidade:'Mensal', metodo:'PIX', status:'PENDENTE', valor:amount, moeda:'BRL', provider:'QA_SIMULADO', providerRef:`${run}:${suffix}`, ...(bundleItems ? {meta:{bundleItems}} : {}) }});
}
async function inspect(payment, expectedCreator, ids, expectedCount) {
 const [p, sales, benefits] = await Promise.all([
  prisma.pagamento.findUnique({where:{id:payment.id}}),
  prisma.creatorVenda.findMany({where:{pagamentoId:payment.id}}),
  prisma.pagamentoBeneficio.findMany({where:{pagamentoId:payment.id}})
 ]);
 const validSales = sales.length === expectedCount && sales.every(s => s.creatorId === expectedCreator.id && s.status === 'CONFIRMADA' && ids.includes(s.metodologiaAvulsaId));
 const validBenefits = benefits.length === expectedCount && benefits.every(b => b.tipo === 'METODOLOGIA_AVULSA' && ids.includes(b.recursoId));
 const balanced = sales.every(s => Math.abs(Number(s.valorBruto)-Number(s.valorFootera)-Number(s.valorCreator)) < .011);
 check(p?.status === 'APROVADO', 'Pagamento aprovado', payment.id);
 check(validSales, 'CreatorVenda pertence ao Creator correto', `${sales.length}/${expectedCount}`);
 check(validBenefits, 'Benefícios vinculados aos itens', `${benefits.length}/${expectedCount}`);
 check(balanced, 'Partilha financeira aritmeticamente consistente');
 return {sales, benefits};
}
async function main() {
 console.log('Banco:', url.host+url.pathname, '| Execução:',run);
 const buyer = await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},deletedAt:null},orderBy:{dataCriacao:'desc'}});
 if (!buyer) throw Error('Comprador qa_rec_atleta_* ausente: execute antes o teste de billing original.');
 const perfil = await prisma.atleta.findUnique({where:{usuarioId:buyer.id}});
 if (!perfil) throw Error('Comprador sem perfil Atleta');
 const owner = await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_TEST_NOT_FOR_LOGIN',nome:'Creator QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
 const creatorPersonal = await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
 const org = await prisma.organizacao.create({data:{tipo:'CLUBE',nome:`Clube ${run}`,ativo:true}});
 const clube = await prisma.clube.create({data:{nome:`Clube ${run}`,organizacaoId:org.id}});
 const creatorOrg = await prisma.creator.create({data:{organizacaoId:org.id,tipo:'INSTITUCIONAL',ativo:true,comissaoFootera:'0.1500'}});
 async function metodologia(label, attrs={}) {
  return prisma.metodologiaAvulsa.create({data:{titulo:`QA ${label} ${run}`,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:'20.00',...attrs}});
 }
 const personal = await metodologia('pessoal',{criadorUsuarioId:owner.id});
 const institutional = await metodologia('institucional',{clubeId:clube.id,criadorUsuarioId:owner.id});
 const second = await metodologia('pacote',{criadorUsuarioId:owner.id});
 async function testIndividual(item, creator, suffix) {
  const pg = await createPayment(buyer,perfil,`METODOLOGIA_AVULSA:${item.id}`,'20.00',suffix);
  const result = await webhook(pg,suffix);
  check(result.status===200,`Webhook ${suffix}`,`HTTP ${result.status}`);
  if (result.status!==200) { console.log('Resposta:',result.body); return; }
  const snapshot = await inspect(pg,creator,[item.id],1);
  const repeat = await webhook(pg,suffix);
  const after = await prisma.creatorVenda.count({where:{pagamentoId:pg.id}});
  check(repeat.status===200 && after===snapshot.sales.length,`Reentrega sem venda duplicada: ${suffix}`,`HTTP ${repeat.status}`);
 }
 await testIndividual(personal,creatorPersonal,'personal');
 await testIndividual(institutional,creatorOrg,'institutional');
 const items=[personal,second].map(x=>({planoId:`METODOLOGIA_AVULSA:${x.id}`,periodicidade:'Mensal'}));
 const bundle = await createPayment(buyer,perfil,'BUNDLE','40.00','bundle',items);
 const response = await webhook(bundle,'bundle');
 check(response.status===200,'Webhook BUNDLE',`HTTP ${response.status}`);
 if(response.status===200){
  const snapshot = await inspect(bundle,creatorPersonal,[personal.id,second.id],2);
  check(new Set(snapshot.sales.map(s=>s.providerRef)).size===2,'Referências únicas das duas vendas');
  const repeat=await webhook(bundle,'bundle');
  const salesCount=await prisma.creatorVenda.count({where:{pagamentoId:bundle.id}});
  check(repeat.status===200 && salesCount===2,'BUNDLE repetido não duplica vendas');
 } else console.log('Resposta:',response.body);
 console.log(`\nRESULTADO: ${pass}/${pass+fail} verificações aprovadas. Dados QA mantidos para auditoria.`);
 if(fail) process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
