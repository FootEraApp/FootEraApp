/** QA exclusivo: preservacao de validade em compras de metodologias avulsas. */
'use strict';
const path=require('node:path');
const crypto=require('node:crypto');
const dotenv=require('dotenv');
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('@prisma/client');
dotenv.config({path:path.join(process.cwd(),'server','.env.development'),quiet:true});
const db=new URL(process.env.DATABASE_URL||'http://invalid');
if(!['127.0.0.1','localhost'].includes(db.hostname)||db.port!=='5433'||db.pathname!=='/footera_billing_qa'||process.env.NODE_ENV==='production'||Boolean(process.env.MP_ACCESS_TOKEN)||process.env.BILLING_CUPOM_RESERVA_QA!=='true'||process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS!=='true') throw Error('SEGURANCA: somente localhost:5433/footera_billing_qa, modo fake QA');
const api=process.env.FOOTERA_QA_API||'http://127.0.0.1:3001';
if(!['http://127.0.0.1:3001','http://localhost:3001'].includes(api)||!process.env.JWT_SECRET||!process.env.BILLING_WEBHOOK_SECRET) throw Error('API/segredos locais obrigatorios');
const prisma=new PrismaClient();
const run=`qa-validade-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let passed=0,failed=0;
const check=(condition,description,extra='')=>{console.log(`${condition?'✔':'✖'} ${description}${extra?' — '+extra:''}`);condition?passed++:failed++;};
const must=(condition,description)=>{if(!condition)throw Error('TESTE INTERROMPIDO: '+description)};
const iso=d=>d instanceof Date?d.toISOString():String(d);
const plusDays=(n)=>new Date(Date.now()+n*24*60*60*1000);
async function post(endpoint,body,headers={}){const resp=await fetch(`${api}/api/billing/${endpoint}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:resp.status,body:await resp.json().catch(()=>({}))};}
async function main(){
 console.log('Banco QA:',db.host+db.pathname,'|',run);
 const buyer=await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},verified:true,deletedAt:null,atleta:{isNot:null}},orderBy:{dataCriacao:'desc'}});
 must(buyer,'comprador atleta QA nao encontrado');
 const auth={authorization:'Bearer '+jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'})};
 const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator Validade QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
 await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
 const course=label=>prisma.metodologiaAvulsa.create({data:{titulo:`QA Validade ${label} ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:'25.00'}});
 const access=c=>prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:c.id,usuarioId:buyer.id}}});
 async function checkout(c,label){const r=await post('checkout',{planoId:`METODOLOGIA_AVULSA:${c.id}`,periodicidade:'Mensal',metodo:'PIX',pagador:{nome:'QA Validade',email:`buyer-${run}@qa.invalid`}},auth);must(r.status===200&&r.body?.pagamento?.id,`checkout ${label} HTTP ${r.status} ${JSON.stringify(r.body).slice(0,180)}`);const pg=await prisma.pagamento.findUnique({where:{id:r.body.pagamento.id}});must(pg?.provider==='INTERNAL_FAKE'&&pg.status==='PENDENTE',`pagamento ${label} nao e fake QA`);return pg;}
 const ev=(type,pg,suffix)=>post('webhook/provider',{provider:'INTERNAL_FAKE',providerEventId:`${run}:${suffix}`,tipo:type,data:{pagamentoId:pg.id}},{'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET});
 async function approve(c,label){const pg=await checkout(c,label);const r=await ev('payment_approved',pg,`approve-${label}`);must(r.status===200,`aprovacao ${label}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0,180)}`);return pg;}
 const far=await course('prazo-distante');await approve(far,'far-1');
 const first=await access(far);must(first?.status==='ATIVA','primeiro acesso distante ausente');
 const distant=plusDays(180);
 await prisma.metodologiaAssinante.update({where:{id:first.id},data:{expiraEm:distant,aulasConcluidas:7,pontosGanhos:31,progresso:{qa:run,etapa:3}}});
 await approve(far,'far-2');const farAfter=await access(far);
 check(farAfter?.expiraEm?.getTime()===distant.getTime(),'Compra posterior nao diminui validade',`antes=${iso(distant)} depois=${iso(farAfter?.expiraEm)}`);
 check(farAfter?.aulasConcluidas===7&&farAfter?.pontosGanhos===31&&farAfter?.progresso?.qa===run,'Progresso e pontos preservados');
 const near=await course('prazo-curto');await approve(near,'near-1');const nearFirst=await access(near);must(nearFirst,'acesso curto nao criado');
 const short=plusDays(2);await prisma.metodologiaAssinante.update({where:{id:nearFirst.id},data:{expiraEm:short}});
 await approve(near,'near-2');const nearAfter=await access(near);
 check(nearAfter?.expiraEm instanceof Date&&nearAfter.expiraEm.getTime()>short.getTime()+14*24*60*60*1000,'Nova compra aumenta validade anteriormente curta',`antes=${iso(short)} depois=${iso(nearAfter?.expiraEm)}`);
 const unlimited=await course('sem-prazo');await approve(unlimited,'unlimited-1');const unlimitedFirst=await access(unlimited);must(unlimitedFirst,'acesso sem prazo ausente');
 await prisma.metodologiaAssinante.update({where:{id:unlimitedFirst.id},data:{expiraEm:null}});
 await approve(unlimited,'unlimited-2');const unlimitedAfter=await access(unlimited);
 check(unlimitedAfter?.status==='ATIVA'&&unlimitedAfter.expiraEm===null,'Acesso ativo sem vencimento continua sem vencimento');
 const canceled=await course('cancelado');await approve(canceled,'canceled-1');const canceledFirst=await access(canceled);must(canceledFirst,'acesso para reativacao ausente');
 await prisma.metodologiaAssinante.update({where:{id:canceledFirst.id},data:{status:'CANCELADA',cancelouEm:new Date(),expiraEm:plusDays(200)}});
 await approve(canceled,'canceled-2');const canceledAfter=await access(canceled);
 check(canceledAfter?.status==='ATIVA'&&canceledAfter.cancelouEm===null&&canceledAfter.expiraEm instanceof Date&&canceledAfter.expiraEm.getTime()<plusDays(90).getTime(),'Acesso cancelado reativado com novo prazo');
 const learning=await course('learning');await approve(learning,'learning-1');const learningFirst=await access(learning);must(learningFirst,'acesso de origem LEARNING ausente');
 await prisma.metodologiaAssinante.update({where:{id:learningFirst.id},data:{origem:'LEARNING',expiraEm:plusDays(300)}});
 const pendingLearning=await checkout(learning,'learning-2');const learningResponse=await ev('payment_approved',pendingLearning,'learning-second-approval');
 const [learningAfter,learningPg]=await Promise.all([access(learning),prisma.pagamento.findUnique({where:{id:pendingLearning.id}})]);
 check(learningResponse.status!==200&&learningAfter?.origem==='LEARNING'&&learningAfter?.status==='ATIVA','Origem LEARNING nao e sobrescrita',`HTTP ${learningResponse.status}`);
 check(learningPg?.status!=='APROVADO','Aprovacao com origem conflitante nao e confirmada no banco',`status=${learningPg?.status}`);
 const concurrent=await course('aprovacoes-paralelas');await approve(concurrent,'concurrent-1');const concFirst=await access(concurrent);must(concFirst,'acesso concorrencia ausente');const veryFar=plusDays(250);
 await prisma.metodologiaAssinante.update({where:{id:concFirst.id},data:{expiraEm:veryFar}});
 const [p1,p2]=await Promise.all([checkout(concurrent,'parallel-1'),checkout(concurrent,'parallel-2')]);
 const initial=await Promise.all([ev('payment_approved',p1,'parallel-approve-1'),ev('payment_approved',p2,'parallel-approve-2')]);
 const final=[...initial];for(let attempt=0;attempt<2;attempt++){if(final[0].status!==200)final[0]=await ev('payment_approved',p1,`parallel-retry-1-${attempt}`);if(final[1].status!==200)final[1]=await ev('payment_approved',p2,`parallel-retry-2-${attempt}`);if(final.every(x=>x.status===200))break;}
 const [concAfter,bens,sales,pg1,pg2]=await Promise.all([access(concurrent),prisma.pagamentoBeneficio.findMany({where:{pagamentoId:{in:[p1.id,p2.id]}}}),prisma.creatorVenda.findMany({where:{pagamentoId:{in:[p1.id,p2.id]}}}),prisma.pagamento.findUnique({where:{id:p1.id}}),prisma.pagamento.findUnique({where:{id:p2.id}})]);
 check(final.every(x=>x.status===200)&&pg1?.status==='APROVADO'&&pg2?.status==='APROVADO','Duas aprovacoes concorrentes concluidas',`primeiros=${initial.map(x=>x.status).join('/')} finais=${final.map(x=>x.status).join('/')}`);
 check(concAfter?.expiraEm?.getTime()===veryFar.getTime()&&concAfter?.status==='ATIVA','Aprovacoes paralelas preservam maior validade');
 check(bens.length===2&&bens.every(x=>x.revogadoEm===null)&&sales.length===2&&sales.every(x=>x.status==='CONFIRMADA'),'Aprovacoes paralelas sem beneficios ou vendas duplicados');
 console.log(`\nRESULTADO: ${passed}/${passed+failed} verificacoes aprovadas. Banco footera_billing_qa.`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
