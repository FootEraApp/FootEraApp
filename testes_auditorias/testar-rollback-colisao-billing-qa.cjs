/** QA LOCAL SOMENTE. Testa rollback do bundle e contenção real no acesso. */
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
dotenv.config({path:path.join(process.cwd(),'server','.env.development'),quiet:true});
const db = new URL(process.env.DATABASE_URL || 'http://invalid');
if(!['127.0.0.1','localhost'].includes(db.hostname)||db.port!=='5433'||db.pathname!=='/footera_billing_qa'||process.env.NODE_ENV==='production'||Boolean(process.env.MP_ACCESS_TOKEN)||process.env.BILLING_CUPOM_RESERVA_QA!=='true'||process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS!=='true') throw Error('SEGURANCA: banco QA local 5433 e modo fake obrigatorios');
const api=process.env.FOOTERA_QA_API||'http://127.0.0.1:3001';
if(!['http://127.0.0.1:3001','http://localhost:3001'].includes(api)||!process.env.JWT_SECRET||!process.env.BILLING_WEBHOOK_SECRET)throw Error('API e segredos de QA obrigatorios');
const prisma=new PrismaClient();
const run=`qa-rollback-lock-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let passed=0,failed=0;
function check(ok,label,detail=''){console.log(`${ok?'✔':'✖'} ${label}${detail?' — '+detail:''}`);ok?passed++:failed++;}
function must(ok,msg){if(!ok)throw Error('TESTE INTERROMPIDO: '+msg);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function post(endpoint,body,headers={}){const r=await fetch(`${api}/api/billing/${endpoint}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return{status:r.status,body:await r.json().catch(()=>({}))};}
async function main(){
 console.log('Banco QA:',db.host+db.pathname,'|',run);
 const buyer=await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},verified:true,deletedAt:null,atleta:{isNot:null}},orderBy:{dataCriacao:'desc'}});
 must(buyer,'comprador QA ausente');
 const auth={authorization:`Bearer ${jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'})}`};
 const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator Rollback QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
 await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
 const course=label=>prisma.metodologiaAvulsa.create({data:{titulo:`QA rollback ${label} ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:'25.00'}});
 const item=c=>({planoId:`METODOLOGIA_AVULSA:${c.id}`,periodicidade:'Mensal'});
 async function checkout(items,label){const endpoint=items.length===1?'checkout':'checkout-bundle';const body=items.length===1?{...items[0]}:{items};const r=await post(endpoint,{...body,metodo:'PIX',pagador:{nome:'Comprador QA',email:`buyer-${run}@qa.invalid`}},auth);must(r.status===200&&r.body?.pagamento?.id,`checkout ${label} HTTP ${r.status}: ${JSON.stringify(r.body).slice(0,220)}`);const pg=await prisma.pagamento.findUnique({where:{id:r.body.pagamento.id}});must(pg?.provider==='INTERNAL_FAKE'&&pg.status==='PENDENTE',`checkout ${label} nao usou fake QA`);return pg;}
 const event=(tipo,pg,suffix)=>post('webhook/provider',{provider:'INTERNAL_FAKE',providerEventId:`${run}:${suffix}`,tipo,data:{pagamentoId:pg.id}},{'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET});
 const access=c=>prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:c.id,usuarioId:buyer.id}}});
 // ROLLBACK APOS A PRIMEIRA LINHA DO BUNDLE:
 const first=await course('bundle-primeiro');const second=await course('bundle-segundo');
 const seed=await checkout([item(second)],'preparar-learning');
 must((await event('payment_approved',seed,'seed-learning')).status===200,'aprovar compra de base para origem LEARNING');
 const existing=await access(second);must(existing?.status==='ATIVA','acesso segundo ausente');
 await prisma.metodologiaAssinante.update({where:{id:existing.id},data:{origem:'LEARNING'}});
 const bundle=await checkout([item(first),item(second)],'bundle-com-conflito-na-segunda-linha');
 const rollbackResult=await event('payment_approved',bundle,'bundle-rollback');
 const [bundleAfter,firstAfter,secondAfter,bensRollback,salesRollback]=await Promise.all([
   prisma.pagamento.findUnique({where:{id:bundle.id}}), access(first),access(second),
   prisma.pagamentoBeneficio.findMany({where:{pagamentoId:bundle.id}}),prisma.creatorVenda.findMany({where:{pagamentoId:bundle.id}})
 ]);
 check(rollbackResult.status!==200,'Bundle com conflito na segunda linha foi recusado',`HTTP ${rollbackResult.status}`);
 check(bundleAfter?.status==='PENDENTE','Rollback manteve pagamento pendente');
 check(firstAfter===null,'Rollback desfez acesso criado na primeira linha');
 check(bensRollback.length===0&&salesRollback.length===0,'Rollback desfez beneficios e vendas do bundle');
 check(secondAfter?.origem==='LEARNING'&&secondAfter.status==='ATIVA','Rollback preservou acesso preexistente LEARNING');
 // COLISAO FORCADA POR LOCK DE LINHA: trava a metodologia durante dois webhooks.
 const shared=await course('lock-compartilhado');
 const old=await checkout([item(shared)],'antigo');must((await event('payment_approved',old,'approve-old')).status===200,'aprovar pagamento anterior');
 const fresh=await checkout([item(shared)],'novo');
 const row=await access(shared);must(row?.status==='ATIVA','acesso de contenção ausente');
 let releaseReady;const release=new Promise(r=>{releaseReady=r});
 let lockedReady;const locked=new Promise(r=>{lockedReady=r});
 const lockingTx=prisma.$transaction(async(tx)=>{
   await tx.$queryRaw`SELECT id FROM "MetodologiaAssinante" WHERE id=${row.id} FOR UPDATE`;
   lockedReady();
   await release;
 },{maxWait:10000,timeout:10000});
 await locked;
 let doneApprove=false,doneRefund=false;
 const approvePromise=event('payment_approved',fresh,'concurrent-new-approve').then(r=>{doneApprove=true;return r});
 const refundPromise=event('payment_refunded',old,'concurrent-old-refund').then(r=>{doneRefund=true;return r});
 await sleep(500);
 const blocked=!doneApprove&&!doneRefund;
 releaseReady();
 await lockingTx;
 let approveRes=await approvePromise,refundRes=await refundPromise;
 for(let attempt=0;attempt<2&&approveRes.status!==200;attempt++)approveRes=await event('payment_approved',fresh,`retry-approve-${attempt}`);
 for(let attempt=0;attempt<2&&refundRes.status!==200;attempt++)refundRes=await event('payment_refunded',old,`retry-refund-${attempt}`);
 const [oldPg,newPg,oldBen,newBen,oldSales,newSales,finalAccess]=await Promise.all([
   prisma.pagamento.findUnique({where:{id:old.id}}),prisma.pagamento.findUnique({where:{id:fresh.id}}),
   prisma.pagamentoBeneficio.findMany({where:{pagamentoId:old.id}}),prisma.pagamentoBeneficio.findMany({where:{pagamentoId:fresh.id}}),
   prisma.creatorVenda.findMany({where:{pagamentoId:old.id}}),prisma.creatorVenda.findMany({where:{pagamentoId:fresh.id}}), access(shared)
 ]);
 check(blocked,'Webhooks ficaram bloqueados enquanto acesso estava travado',`aprovacaoConcluida=${doneApprove} reembolsoConcluido=${doneRefund}`);
 check(approveRes.status===200&&refundRes.status===200,'Webhooks concluiram apos liberacao do lock',`${approveRes.status}/${refundRes.status}`);
 check(oldPg?.status==='REEMBOLSADO'&&newPg?.status==='APROVADO','Estados financeiros corretos apos lock');
 check(oldBen.length===1&&!!oldBen[0].revogadoEm&&newBen.length===1&&newBen[0].revogadoEm===null,'Beneficios preservados corretamente');
 check(oldSales.length===1&&oldSales[0].status==='REEMBOLSADA'&&newSales.length===1&&newSales[0].status==='CONFIRMADA','Vendas sem duplicidade apos lock');
 check(finalAccess?.status==='ATIVA'&&finalAccess.origem==='AVULSA','Acesso final ativo apos disputa');
 console.log(`\nRESULTADO: ${passed}/${passed+failed} verificacoes aprovadas. Banco footera_billing_qa.`);
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
