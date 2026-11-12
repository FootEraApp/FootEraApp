/** QA exclusivamente local: usa API real em modo fake e banco descartavel. */
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
dotenv.config({path:path.join(process.cwd(),'server','.env.development'),quiet:true});
const db = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost','127.0.0.1'].includes(db.hostname) || db.port !== '5433' || db.pathname !== '/footera_billing_qa') throw Error('SEGURANÇA: DATABASE_URL deve ser localhost:5433/footera_billing_qa');
if (process.env.NODE_ENV === 'production' || process.env.MP_ACCESS_TOKEN || process.env.BILLING_CUPOM_RESERVA_QA !== 'true' || !process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS || process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS !== 'true') throw Error('SEGURANÇA: use modo fake QA, com CUPOM_RESERVA_QA e METODOLOGIAS_AVULSAS true');
const api = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['http://127.0.0.1:3001','http://localhost:3001'].includes(api)) throw Error('SEGURANÇA: API local obrigatória');
if (!process.env.JWT_SECRET || !process.env.BILLING_WEBHOOK_SECRET) throw Error('JWT_SECRET/BILLING_WEBHOOK_SECRET ausente');
const prisma = new PrismaClient();
const run = `qa-refund-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let good=0,bad=0;
function check(cond,label,details='') { console.log(`${cond?'✔':'✖'} ${label}${details?' — '+details:''}`); cond ? good++ : bad++; }
function assertAbort(cond,msg) { if(!cond) throw new Error(`ABORTADO: ${msg}`); }
async function post(endpoint,payload,headers={}) {
 const r=await fetch(`${api}/api/billing/${endpoint}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
 return {status:r.status,body:await r.json().catch(()=>({}))};
}
async function event(tipo,pg,id,provider='INTERNAL_FAKE') {return post('webhook/provider',{provider,providerEventId:`${run}:${id}`,tipo,data:{pagamentoId:pg.id}},{'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET});}
const cents=x=>Math.round(Number(x)*100);
async function main() {
 console.log('Banco QA:',db.host+db.pathname,'|',run);
 const buyer=await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},verified:true,deletedAt:null,atleta:{isNot:null}},orderBy:{dataCriacao:'desc'}});
 assertAbort(buyer,'comprador QA Atleta não encontrado');
 const atleta=await prisma.atleta.findUnique({where:{usuarioId:buyer.id}});
 assertAbort(atleta,'perfil Atleta ausente');
 const token=jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'});
 const auth={authorization:`Bearer ${token}`};
 const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator QA Refund',email:`${run}@qa.invalid`,tipo:'Creator'}});
 await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
 const course=await prisma.metodologiaAvulsa.create({data:{titulo:`Reembolso QA ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:'25.00'}});
 const payer={nome:'Comprador QA',email:`comprador-${run}@qa.invalid`};
 async function checkout(label) {
  const r=await post('checkout',{planoId:`METODOLOGIA_AVULSA:${course.id}`,periodicidade:'Mensal',metodo:'PIX',pagador:payer},auth);
  assertAbort(r.status===200 && r.body?.pagamento?.id,`checkout ${label}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0,400)}`);
  const pg=await prisma.pagamento.findUnique({where:{id:r.body.pagamento.id}});
  assertAbort(pg && pg.provider==='INTERNAL_FAKE' && pg.status==='PENDENTE',`servidor não está no mesmo banco QA e provedor fake (${label})`);
  return pg;
 }
 // Compra A -> aprovação -> reembolso e idempotência.
 const a=await checkout('A');
 const approvedA=await event('payment_approved',a,'approve-A');
 assertAbort(approvedA.status===200,`aprovação A HTTP ${approvedA.status} ${JSON.stringify(approvedA.body)}`);
 const before=await prisma.pagamentoBeneficio.findMany({where:{pagamentoId:a.id}});
 const saleBefore=await prisma.creatorVenda.findMany({where:{pagamentoId:a.id}});
 check(before.length===1 && before[0].tipo==='METODOLOGIA_AVULSA' && !before[0].revogadoEm,'Benefício inicial vinculado à compra A');
 check(saleBefore.length===1 && saleBefore[0].status==='CONFIRMADA' && cents(saleBefore[0].valorBruto)===2500,'Venda Creator confirmada da compra A');
 assertAbort(before.length===1 && saleBefore.length===1,'provisionamento A incompleto; não tentar estorno');
 const refundA=await event('payment_refunded',a,'refund-A');
 const pgA=await prisma.pagamento.findUnique({where:{id:a.id}});
 const benefitA=await prisma.pagamentoBeneficio.findFirst({where:{pagamentoId:a.id}});
 const saleA=await prisma.creatorVenda.findFirst({where:{pagamentoId:a.id}});
 const accessA=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:course.id,usuarioId:buyer.id}}});
 check(refundA.status===200 && pgA?.status==='REEMBOLSADO','Reembolso A processado',`HTTP ${refundA.status}, status=${pgA?.status}`);
 check(!!benefitA?.revogadoEm,'Benefício A revogado');
 check(saleA?.status==='REEMBOLSADA','Venda A marcada REEMBOLSADA');
 check(accessA?.status==='CANCELADA','Acesso exclusivo da compra A cancelado',`status=${accessA?.status}`);
 assertAbort(pgA?.status==='REEMBOLSADO','reembolso A não foi concluído');
 const same=await event('payment_refunded',a,'refund-A');
 const newer=await event('payment_refunded',a,'refund-A-new-event');
 const afterA=await prisma.pagamentoBeneficio.findFirst({where:{pagamentoId:a.id}});
 check(same.status===200 && same.body?.idempotent===true,'Reentrega com mesmo evento é idempotente');
 check(newer.status===200 && (await prisma.pagamento.findUnique({where:{id:a.id}}))?.status==='REEMBOLSADO','Outro evento do mesmo reembolso não estorna de novo');
 check(afterA?.revogadoEm?.getTime()===benefitA?.revogadoEm?.getTime(),'Data de revogação não muda em repetições');
 // Compra B valida -> reembolso A repetido nao pode afetar acesso B.
 const b=await checkout('B');
 const approvedB=await event('payment_approved',b,'approve-B');
 assertAbort(approvedB.status===200,`aprovação B HTTP ${approvedB.status}`);
 const accessB=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:course.id,usuarioId:buyer.id}}});
 check(accessB?.status==='ATIVA','Segunda compra restaura acesso ATIVO');
 const repeatA=await event('payment_refunded',a,'refund-A-after-B');
 const afterRepeatA=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:course.id,usuarioId:buyer.id}}});
 check(repeatA.status===200 && afterRepeatA?.status==='ATIVA','Reembolso A repetido preserva segunda compra');
 // Compra C e D: quando C reembolsa mas D sustenta o mesmo recurso, acesso permanece.
 const c=await checkout('C');
 assertAbort((await event('payment_approved',c,'approve-C')).status===200,'aprovação C');
 const refundC=await event('payment_refunded',c,'refund-C');
 const accessAfterC=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:course.id,usuarioId:buyer.id}}});
 check(refundC.status===200 && accessAfterC?.status==='ATIVA','Reembolso de compra C com compra B válida preserva acesso');
 check((await prisma.creatorVenda.findFirst({where:{pagamentoId:c.id}}))?.status==='REEMBOLSADA','Venda Creator C revertida individualmente');
 check((await prisma.creatorVenda.findFirst({where:{pagamentoId:b.id}}))?.status==='CONFIRMADA','Venda Creator B permanece confirmada');
 // Bloqueio de bundle, simulado sem aprovação para evitar benefícios indevidos.
 const bundle=await prisma.pagamento.create({data:{usuarioId:buyer.id,contextoKind:'PERSONAL',contextoTipo:'Atleta',contextoPerfilId:atleta.id,plano:'BUNDLE',periodicidade:'Mensal',metodo:'PIX',status:'PENDENTE',valor:'25.00',moeda:'BRL',provider:'INTERNAL_FAKE',providerRef:`${run}:bundle`}});
 const denied=await event('payment_refunded',bundle,'bundle-denied');
 check(denied.status===503 && (await prisma.pagamento.findUnique({where:{id:bundle.id}}))?.status==='PENDENTE','Bundle não suportado é recusado sem mutação',`HTTP ${denied.status}`);
 // Tentativas concorrentes de estornar B. A função deve garantir uma só reversão.
 const both=await Promise.all([event('payment_refunded',b,'refund-B-1'),event('payment_refunded',b,'refund-B-2')]);
 const finalB=await prisma.pagamento.findUnique({where:{id:b.id}});
 const finalSales=await prisma.creatorVenda.findMany({where:{pagamentoId:b.id}});
 check(both.every(x=>[200,503].includes(x.status)) && finalB?.status==='REEMBOLSADO','Concorrência B não corrompe pagamento',`HTTP ${both.map(x=>x.status).join('/')}`);
 check(finalSales.length===1 && finalSales[0].status==='REEMBOLSADA','Concorrência B não duplica vendas');
 const summary=`RESULTADO: ${good}/${good+bad} verificações aprovadas. Banco: footera_billing_qa.`;
 console.log('\n'+summary);
 if(bad) process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
