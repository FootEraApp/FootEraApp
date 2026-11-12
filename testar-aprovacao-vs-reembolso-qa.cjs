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
const run = `qa-approve-refund-race-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
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
  const results=await Promise.all([event('payment_refunded',p1,'refund-P1'),event('payment_refunded',p2,'refund-P2')]);
  // Um HTTP 503 pode significar contenção temporária do webhook; tente novamente com IDs novos.
  for (const [index, response] of results.entries()) {
    if (response.status!==200) {
      const pg=index===0?p1:p2;
      await event('payment_refunded',pg,`refund-retry-${index}`);
    }
  }
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
  // NOVA BATERIA: aprovação de novo pagamento contra reembolso do anterior.
  // Não há garantia de colisão exata: as requisições são disparadas juntas.
  for (let rodada = 1; rodada <= 3; rodada++) {
    const produto = await course(`aprovacao-versus-reembolso-${rodada}`);
    const anterior = await payment(produto, `race-antigo-${rodada}`);

    const novoCheckout = await post('checkout', {
      planoId: `METODOLOGIA_AVULSA:${produto.id}`,
      periodicidade: 'Mensal',
      metodo: 'PIX',
      pagador: { nome: 'QA', email: `buyer-${run}@qa.invalid` },
    }, auth);
    must(novoCheckout.status === 200 && novoCheckout.body?.pagamento?.id,
      `Checkout novo da rodada ${rodada}: HTTP ${novoCheckout.status}`);

    const novo = await prisma.pagamento.findUnique({
      where: { id: novoCheckout.body.pagamento.id },
    });
    must(novo?.provider === 'INTERNAL_FAKE' && novo.status === 'PENDENTE',
      `Pagamento novo da rodada ${rodada} não está pendente no QA`);

    const simultaneos = await Promise.all([
      event('payment_approved', novo, `race-approve-new-${rodada}`),
      event('payment_refunded', anterior, `race-refund-old-${rodada}`),
    ]);
    const respostas = [...simultaneos];

    // Um 503 pode ser contenção transitória; reenvie uma única vez com evento novo.
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      if (respostas[0].status !== 200) {
        respostas[0] = await event('payment_approved', novo,
          `race-retry-approve-${rodada}-${tentativa}`);
      }
      if (respostas[1].status !== 200) {
        respostas[1] = await event('payment_refunded', anterior,
          `race-retry-refund-${rodada}-${tentativa}`);
      }
      if (respostas.every(r => r.status === 200)) break;
    }

    const [statusAnterior, statusNovo, beneficiosAntigos, beneficiosNovos, vendasAntigas,
      vendasNovas, acessoFinal] = await Promise.all([
      prisma.pagamento.findUnique({ where: { id: anterior.id } }),
      prisma.pagamento.findUnique({ where: { id: novo.id } }),
      prisma.pagamentoBeneficio.findMany({ where: { pagamentoId: anterior.id } }),
      prisma.pagamentoBeneficio.findMany({ where: { pagamentoId: novo.id } }),
      prisma.creatorVenda.findMany({ where: { pagamentoId: anterior.id } }),
      prisma.creatorVenda.findMany({ where: { pagamentoId: novo.id } }),
      prisma.metodologiaAssinante.findUnique({
        where: { metodologiaAvulsaId_usuarioId: {
          metodologiaAvulsaId: produto.id, usuarioId: buyer.id,
        } },
      }),
    ]);

    check(respostas.every(r => r.status === 200),
      `Rodada ${rodada}: ambos webhooks concluídos`,
      `primeiros=${simultaneos.map(r => r.status).join('/')} finais=${respostas.map(r => r.status).join('/')}`);
    check(statusAnterior?.status === 'REEMBOLSADO' && statusNovo?.status === 'APROVADO',
      `Rodada ${rodada}: estados financeiros consistentes`);
    check(beneficiosAntigos.length === 1 && !!beneficiosAntigos[0].revogadoEm &&
      beneficiosNovos.length === 1 && beneficiosNovos[0].revogadoEm === null,
      `Rodada ${rodada}: benefício antigo revogado e novo válido`);
    check(vendasAntigas.length === 1 && vendasAntigas[0].status === 'REEMBOLSADA' &&
      vendasNovas.length === 1 && vendasNovas[0].status === 'CONFIRMADA',
      `Rodada ${rodada}: vendas sem duplicidade`);
    check(acessoFinal?.status === 'ATIVA' && acessoFinal?.origem === 'AVULSA',
      `Rodada ${rodada}: acesso permanece ATIVO`,
      `status=${acessoFinal?.status} origem=${acessoFinal?.origem}`);
  }

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
