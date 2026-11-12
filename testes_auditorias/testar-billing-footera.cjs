/**
 * Teste integrado do providerWebhook real, sem Mercado Pago.
 * Rode SOMENTE com backend e este script apontando para footera_billing_qa.
 * Não cria cobranças reais. Modifica dados APENAS nesse banco descartável.
 */
const path = require('node:path');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), 'server', '.env.development'), quiet: true });
const databaseUrl = process.env.DATABASE_URL || '';
const secret = process.env.BILLING_WEBHOOK_SECRET || '';
const apiBase = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
const expectedDb = 'footera_billing_qa';
let u;
try { u = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL ausente ou inválida.'); }
if (u.pathname.replace(/^\//,'') !== expectedDb || !['127.0.0.1','localhost'].includes(u.hostname)) {
  throw new Error(`SEGURANÇA: DATABASE_URL deve ser localhost/${expectedDb}; recebido ${u.hostname}${u.pathname}`);
}
if (!['http://127.0.0.1:3001','http://localhost:3001'].includes(apiBase)) {
  throw new Error('SEGURANÇA: FOOTERA_QA_API deve ser localhost:3001.');
}
if (!secret) throw new Error('BILLING_WEBHOOK_SECRET não configurado para o teste.');
const prisma = new PrismaClient();
const runId = `qa-billing-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const records = [];
let failures = 0;
function assert(cond, description, detail) {
  const ok = !!cond;
  records.push({ resultado: ok ? 'APROVADO' : 'FALHOU', teste: description, ...(detail ? { detalhe: detail } : {}) });
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✖'} ${description}${detail ? ` — ${detail}` : ''}`);
}
async function post(eventId, tipo, pagamentoId, auth = secret, provider = "QA_SIMULADO") {
  const response = await fetch(`${apiBase}/api/billing/webhook/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': auth },
    body: JSON.stringify({ provider, providerEventId: eventId, tipo, data: { pagamentoId } }),
    signal: AbortSignal.timeout(18000),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
async function makePayment(usuario, perfil, suffix) {
  return prisma.pagamento.create({ data: {
    usuarioId: usuario.id,
    contextoKind: 'PERSONAL',
    contextoTipo: 'Atleta',
    contextoPerfilId: perfil.id,
    plano: 'ATLETA_PRO',
    periodicidade: 'Mensal',
    metodo: 'PIX',
    status: 'PENDENTE',
    valor: '19.90',
    moeda: 'BRL',
    provider: 'QA_SIMULADO',
    providerRef: `${runId}:${suffix}`,
  }});
}
async function main() {
  console.log('Banco alvo:', `${u.hostname}:${u.port}${u.pathname}`);
  console.log('API alvo:', apiBase);
  console.log('Execução:', runId);
  const usuario = await prisma.usuario.findFirst({ where: { nomeDeUsuario: { startsWith: 'qa_rec_atleta_' }, deletedAt: null }, orderBy: { dataCriacao: 'desc' } });
  if (!usuario) throw new Error('Conta qa_rec_atleta_* não encontrada na cópia do banco.');
  const perfil = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id }, select: { id: true } });
  if (!perfil) throw new Error('Conta QA não tem perfil físico Atleta.');

  // Verificação de que API e script consultam O MESMO banco:
  // cria um pagamento QA, depois exige que o servidor consiga aprová-lo.
  const pg = await makePayment(usuario, perfil, 'aprovacao');
  const ev = `${runId}:approved`;
  const first = await post(ev, 'payment_approved', pg.id);
  const pgAfter = await prisma.pagamento.findUnique({ where: { id: pg.id } });
  const eventAfter = await prisma.eventoPagamento.findUnique({ where: { providerEventId: ev } });
  assert(first.status === 200 && pgAfter?.status === 'APROVADO' && eventAfter?.status === 'CONCLUIDO', 'Aprovação via webhook real', `HTTP ${first.status}, pagamento=${pgAfter?.status}, evento=${eventAfter?.status}`);
  if (!pgAfter || pgAfter.status !== 'APROVADO') {
    throw new Error('API não aprovou pagamento QA. Verifique se o backend aponta para footera_billing_qa; restante abortado.');
  }
  const ass = await prisma.assinatura.findFirst({ where: { usuarioId: usuario.id, plano: 'ATLETA_PRO', contextoKey: 'personal:Atleta' } });
  assert(!!ass, 'Assinatura provisionada pelo controller', `assinatura=${ass?.id ?? 'ausente'}`);

  const second = await post(ev, 'payment_approved', pg.id);
  const ev2 = await prisma.eventoPagamento.findUnique({ where: { providerEventId: ev } });
  assert(second.status === 200 && second.payload?.idempotent === true && ev2?.tentativas === 1, 'Reentrega do mesmo evento sem reprovisionar', `HTTP ${second.status}, tentativas=${ev2?.tentativas}`);

  const pgFail = await makePayment(usuario, perfil, 'falha');
  const missingId = crypto.randomUUID();
  const evFail = `${runId}:missing`;
  const failed = await post(evFail, 'payment_approved', missingId);
  const failedEvent = await prisma.eventoPagamento.findUnique({ where: { providerEventId: evFail } });
  assert(failed.status >= 500 && failedEvent?.status === 'FALHOU', 'Pagamento inexistente: evento recuperável', `HTTP ${failed.status}, evento=${failedEvent?.status}`);
  const retry = await post(evFail, 'payment_approved', missingId);
  const retryEvent = await prisma.eventoPagamento.findUnique({ where: { providerEventId: evFail } });
  assert(retry.status >= 500 && retryEvent?.tentativas === 2, 'Evento falho admite nova tentativa', `tentativas=${retryEvent?.tentativas}`);

  const cancelled = await post(`${runId}:cancel`, 'payment_canceled', pgFail.id);
  const refunded = await post(`${runId}:refund`, 'payment_refunded', pg.id);
  const pgRefund = await prisma.pagamento.findUnique({ where: { id: pg.id } });
  assert(cancelled.status === 503, 'Cancelamento está explicitamente pendente de conciliação (comportamento atual)', `HTTP ${cancelled.status}`);
  assert(refunded.status === 503 && pgRefund?.status === 'APROVADO', 'Reembolso não é marcado como concluído sem conciliação', `HTTP ${refunded.status}, pagamento=${pgRefund?.status}`);

  // Novo fluxo: cancelamento confirmado no QA do provedor INTERNAL_FAKE.
  // Este teste NÃO simula o Mercado Pago: o provider fake é obrigatório.
  const cupomCancelamento = await prisma.cupom.create({
    data: {
      codigo: `${runId}-cancelamento`,
      tipo: 'PERCENTUAL',
      descontoPerc: 10,
      ativo: true,
      usosMax: 1,
      usosAtuais: 0,
    },
  });
  const pgCancelar = await prisma.pagamento.create({ data: {
    usuarioId: usuario.id,
    contextoKind: 'PERSONAL',
    contextoTipo: 'Atleta',
    contextoPerfilId: perfil.id,
    plano: 'ATLETA_PRO',
    periodicidade: 'Mensal',
    metodo: 'PIX',
    status: 'PENDENTE',
    valor: '17.91',
    moeda: 'BRL',
    cupomId: cupomCancelamento.id,
    provider: 'INTERNAL_FAKE',
    providerRef: `${runId}:cancelamento-cupom`,
  }});
  await prisma.cupomReserva.create({data: {
    cupomId: cupomCancelamento.id,
    usuarioId: usuario.id,
    pagamentoId: pgCancelar.id,
    status: 'RESERVADA',
    expiraEm: new Date(Date.now() + 48 * 60 * 60 * 1000),
  }});

  const evCancelamento = `${runId}:cancelamento-confirmado`;
  const cancelamentoQa = await post(
    evCancelamento, 'payment_canceled', pgCancelar.id, secret, 'INTERNAL_FAKE'
  );
  const pagamentoCancelado = await prisma.pagamento.findUnique({where:{id:pgCancelar.id}});
  const reservaLiberada = await prisma.cupomReserva.findUnique({where:{pagamentoId:pgCancelar.id}});
  const cupomAposCancelamento = await prisma.cupom.findUnique({where:{id:cupomCancelamento.id}});
  const eventoCancelamento = await prisma.eventoPagamento.findUnique({where:{providerEventId:evCancelamento}});

  assert(cancelamentoQa.status === 200 && pagamentoCancelado?.status === 'CANCELADO' && !!pagamentoCancelado.canceladoEm,
    'Cancelamento fake confirmado altera pagamento', `HTTP ${cancelamentoQa.status}, status=${pagamentoCancelado?.status}`);
  assert(reservaLiberada?.status === 'LIBERADA' && !!reservaLiberada.liberadaEm,
    'Cancelamento libera reserva atomicamente', `reserva=${reservaLiberada?.status}`);
  assert(cupomAposCancelamento?.usosAtuais === 0 && eventoCancelamento?.status === 'CONCLUIDO',
    'Cancelamento não consome cupom e conclui evento');
  assert((await prisma.pagamentoBeneficio.count({where:{pagamentoId:pgCancelar.id}})) === 0 &&
         (await prisma.cupomResgate.count({where:{pagamentoId:pgCancelar.id}})) === 0 &&
         (await prisma.creatorVenda.count({where:{pagamentoId:pgCancelar.id}})) === 0,
    'Cancelamento não concede benefícios, resgates nem vendas');

  const cancelamentoRepetido = await post(
    evCancelamento, 'payment_canceled', pgCancelar.id, secret, 'INTERNAL_FAKE'
  );
  assert(cancelamentoRepetido.status === 200 && cancelamentoRepetido.payload?.idempotent === true &&
         (await prisma.eventoPagamento.findUnique({where:{providerEventId:evCancelamento}}))?.tentativas === 1,
    'Cancelamento repetido é idempotente', `HTTP ${cancelamentoRepetido.status}`);

  const aprovadoTardiamente = await post(
    `${runId}:aprovacao-depois-cancelamento`, 'payment_approved', pgCancelar.id, secret, 'INTERNAL_FAKE'
  );
  const aposTentativaTardia = await prisma.pagamento.findUnique({where:{id:pgCancelar.id}});
  assert(aprovadoTardiamente.status >= 500 && aposTentativaTardia?.status === 'CANCELADO' &&
         (await prisma.pagamentoBeneficio.count({where:{pagamentoId:pgCancelar.id}})) === 0,
    'Aprovação tardia após cancelamento não concede benefícios',
    `HTTP ${aprovadoTardiamente.status}, status=${aposTentativaTardia?.status}`);

  // Uma liberação comprovada deve deixar a utilização disponível novamente.
  const novasReservasAtivas = await prisma.cupomReserva.count({where:{
    cupomId:cupomCancelamento.id, status:{in:['RESERVADA','CONCILIACAO_PENDENTE']}
  }});
  assert(cupomAposCancelamento?.usosAtuais + novasReservasAtivas < cupomCancelamento.usosMax,
    'Cupom cancelado volta a ter capacidade disponível');

  const pgConcurrent = await makePayment(usuario, perfil, 'concorrencia');
  const evConcurrent = `${runId}:parallel`;
  const parallel = await Promise.all([post(evConcurrent, 'payment_approved', pgConcurrent.id), post(evConcurrent, 'payment_approved', pgConcurrent.id)]);
  const evConcurrentDb = await prisma.eventoPagamento.findUnique({ where: { providerEventId: evConcurrent } });
  const pgConcurrentDb = await prisma.pagamento.findUnique({ where: { id: pgConcurrent.id } });
  assert(parallel.some(r => r.status === 200) && pgConcurrentDb?.status === 'APROVADO' && evConcurrentDb?.status === 'CONCLUIDO' && evConcurrentDb?.tentativas === 1, 'Duas entregas simultâneas do mesmo evento', `HTTP ${parallel.map(r=>r.status).join('/')}, tentativas=${evConcurrentDb?.tentativas}`);

  const unauthorized = await post(`${runId}:noauth`, 'payment_approved', pgFail.id, 'segredo-incorreto');
  const unauthorizedDb = await prisma.eventoPagamento.findUnique({ where: { providerEventId: `${runId}:noauth` } });
  assert(unauthorized.status === 401 && unauthorizedDb === null, 'Segredo incorreto não registra evento', `HTTP ${unauthorized.status}`);
  console.log('\nRESUMO JSON\n' + JSON.stringify(records, null, 2));
  console.log(`\n${records.length - failures}/${records.length} testes aprovados. Os registros QA permanecem APENAS no banco descartável ${expectedDb}.`);
  if (failures) process.exitCode = 1;
}
main().catch(err => { console.error('\nTESTE INTERROMPIDO:', err.message); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
