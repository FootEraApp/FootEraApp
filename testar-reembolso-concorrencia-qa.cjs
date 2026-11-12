/** Testes isolados de concorrência e origem de acesso. EXCLUSIVO QA LOCAL. */
'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
dotenv.config({path:path.join(process.cwd(),'server','.env.development'),quiet:true});
const db = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost','127.0.0.1'].includes(db.hostname) || db.port !== '5433' || db.pathname !== '/footera_billing_qa' ||
    process.env.NODE_ENV === 'production' || process.env.MP_ACCESS_TOKEN ||
    process.env.BILLING_CUPOM_RESERVA_QA !== 'true' || process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS !== 'true') {
  throw new Error('SEGURANÇA: use somente QA localhost:5433/footera_billing_qa, sem MP, com flags QA.');
}
const api = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['http://127.0.0.1:3001','http://localhost:3001'].includes(api) || !process.env.JWT_SECRET || !process.env.BILLING_WEBHOOK_SECRET) {
  throw new Error('SEGURANÇA: API e segredos locais obrigatórios.');
}
const prisma = new PrismaClient();
const run = `qa-refund-race-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let ok = 0, fail = 0;
function check(value, name, info='') {
  console.log(`${value?'✔':'✖'} ${name}${info?' — '+info:''}`);
  value ? ok++ : fail++;
}
function must(value, message) { if (!value) throw Error('TESTE INTERROMPIDO: '+message); }
async function post(endpoint, body, headers={}) {
  const response = await fetch(`${api}/api/billing/${endpoint}`, {
    method:'POST', headers:{'content-type':'application/json',...headers},
    body:JSON.stringify(body), signal:AbortSignal.timeout(30000),
  });
  return { status:response.status, body:await response.json().catch(()=>({})) };
}
async function main() {
  console.log('Banco QA:', db.host+db.pathname, '|', run);
  const buyer = await prisma.usuario.findFirst({where:{nomeDeUsuario:{startsWith:'qa_rec_atleta_'},verified:true,deletedAt:null,atleta:{isNot:null}},orderBy:{dataCriacao:'desc'}});
  must(buyer, 'Comprador atleta QA ausente');
  const token=jwt.sign({id:buyer.id,tokenVersion:buyer.tokenVersion},process.env.JWT_SECRET,{expiresIn:'15m'});
  const auth={authorization:`Bearer ${token}`};
  const owner=await prisma.usuario.create({data:{nomeDeUsuario:`${run}_owner`,senhaHash:'QA_NO_LOGIN',nome:'Creator Race QA',email:`${run}@qa.invalid`,tipo:'Creator'}});
  await prisma.creator.create({data:{usuarioId:owner.id,tipo:'PESSOA_FISICA',ativo:true,comissaoFootera:'0.1500'}});
  async function course(label) { return prisma.metodologiaAvulsa.create({data:{titulo:`QA ${label} ${run}`,criadorUsuarioId:owner.id,tipo:'CURSO_FORMACAO',estruturaTipo:'MODULO',ativo:true,precoAssinaturaMensal:'25.00'}}); }
  async function payment(course, label) {
    const checkout=await post('checkout',{planoId:`METODOLOGIA_AVULSA:${course.id}`,periodicidade:'Mensal',metodo:'PIX',pagador:{nome:'QA',email:`buyer-${run}@qa.invalid`}},auth);
    must(checkout.status===200 && checkout.body?.pagamento?.id,`Checkout ${label}: HTTP ${checkout.status}`);
    const pg=await prisma.pagamento.findUnique({where:{id:checkout.body.pagamento.id}});
    must(pg?.provider==='INTERNAL_FAKE' && pg.status==='PENDENTE',`Provedor/banco incorreto no checkout ${label}`);
    const approval=await event('payment_approved',pg,`approved-${label}`);
    must(approval.status===200,`Aprovação ${label}: HTTP ${approval.status} ${JSON.stringify(approval.body)}`);
    return pg;
  }
  async function event(tipo,pg,suffix) {
    return post('webhook/provider',{provider:'INTERNAL_FAKE',providerEventId:`${run}:${suffix}`,tipo,data:{pagamentoId:pg.id}}, {'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET});
  }
  const shared=await course('compartilhada');
  const p1=await payment(shared,'P1');
  const p2=await payment(shared,'P2');
  const before=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:shared.id,usuarioId:buyer.id}}});
  must(before?.status==='ATIVA','Acesso compartilhado inicial não está ativo');
  const results = await Promise.all([
    event("payment_refunded", p1, "refund-P1"),
    event("payment_refunded", p2, "refund-P2"),
  ]);

  const finalResults = [...results];

  for (const [index, response] of results.entries()) {
    if (response.status !== 200) {
      const pg = index === 0 ? p1 : p2;

      const retry = await event(
        "payment_refunded",
        pg,
        `refund-retry-${index}`
      );

      finalResults[index] = retry;
    }
  }

  check(
    finalResults.every((r) => r.status === 200),
    "Ambos os reembolsos concluídos após eventual retry",
    finalResults.map((r) => r.status).join("/")
  );
  const [after1,after2,benefits1,benefits2,sales,access] = await Promise.all([
    prisma.pagamento.findUnique({where:{id:p1.id}}), prisma.pagamento.findUnique({where:{id:p2.id}}),
    prisma.pagamentoBeneficio.findMany({where:{pagamentoId:p1.id}}),prisma.pagamentoBeneficio.findMany({where:{pagamentoId:p2.id}}),
    prisma.creatorVenda.findMany({where:{pagamentoId:{in:[p1.id,p2.id]}}}),
    prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:shared.id,usuarioId:buyer.id}}}),
  ]);
  check(after1?.status==='REEMBOLSADO' && after2?.status==='REEMBOLSADO','Dois pagamentos distintos reembolsados',results.map(r=>r.status).join('/'));
  check(benefits1.length===1 && benefits2.length===1 && !!benefits1[0]?.revogadoEm && !!benefits2[0]?.revogadoEm,'Ambos os benefícios revogados');
  check(sales.length===2 && sales.every(s=>s.status==='REEMBOLSADA'),'Duas vendas Creator revertidas uma vez');
  check(access?.status==='CANCELADA','Último direito pago revogado cancela acesso',`status=${access?.status}`);
  const adminCourse=await course('origem-admin');
  const p3=await payment(adminCourse,'admin');
  const adminAccess=await prisma.metodologiaAssinante.findUnique({where:{metodologiaAvulsaId_usuarioId:{metodologiaAvulsaId:adminCourse.id,usuarioId:buyer.id}}});
  must(adminAccess?.status==='ATIVA','Acesso do teste administrativo ausente');
  // Simula uma origem diferente de AVULSA.
  // LEARNING é um valor válido no enum atual.
  await prisma.metodologiaAssinante.update({
    where: {
      id: adminAccess.id,
    },
    data: {
      origem: "LEARNING",
    },
  });
  const denied=await event('payment_refunded',p3,'refund-admin-denied');
  const [adminPayment,adminBenefit,adminSale,adminAfter] = await Promise.all([
    prisma.pagamento.findUnique({where:{id:p3.id}}),
    prisma.pagamentoBeneficio.findFirst({where:{pagamentoId:p3.id}}),
    prisma.creatorVenda.findFirst({where:{pagamentoId:p3.id}}),
    prisma.metodologiaAssinante.findUnique({where:{id:adminAccess.id}}),
  ]);
  check(
    denied.status === 503,
    "Origem LEARNING recusa reembolso automático",
    `HTTP ${denied.status}`
  );

  check(
    adminPayment?.status === "APROVADO" &&
      adminBenefit?.revogadoEm === null &&
      adminSale?.status === "CONFIRMADA",
    "Recusa preserva pagamento, benefício e venda"
  );
  check(
    adminAfter?.origem === "LEARNING" &&
      adminAfter?.status === "ATIVA",
    "Recusa por origem diferente preserva o acesso"
  );
  console.log(`\nRESULTADO: ${ok}/${ok+fail} verificações aprovadas. Banco footera_billing_qa.`);
  if(fail) process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
