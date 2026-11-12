/**
 * QA seguro de rota HTTP real + assinatura HMAC + GET MP simulado +
 * reentrega. Este arquivo NÃO aprova/provisiona pagamento: esse cenário
 * exige fixture isolada de usuário e limpeza de benefícios/assinaturas.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV !== 'test' ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== 'true' ||
    process.env.ENABLE_BILLING_SCHEDULER !== 'false' ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== 'false' ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== 'false' ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== 'false' ||
    db.protocol !== 'postgresql:' ||
    !['localhost', '127.0.0.1'].includes(db.hostname) ||
    db.port !== '5433' || db.pathname !== '/footera_billing_qa' ||
    !process.env.MP_WEBHOOK_SECRET
  ) throw new Error('QA_AMBIENTE_INSEGURO');

  const { prisma } = await import('./server/prisma.js');
  const { prepararCheckoutAtomico, adquirirEnvioCheckout, marcarCheckoutInconclusivo, fingerprintCheckout } = await import('./server/services/billingCheckoutOperacaoService.js');
  const { configurarConsultorMercadoPagoQa } = await import('./server/services/billingMercadoPagoGateway.js');
  const { default: billingRoutes } = await import('./server/routes/billing.js');
  let server: ReturnType<ReturnType<typeof express>['listen']> | null = null;
  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;
  let passou = false;
  let contadorGet = 0;
  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, 'footera_billing_qa');
    const atleta = await prisma.atleta.findFirst({ select: { usuarioId: true } });
    assert.ok(atleta, 'QA_SEM_ATLETA');
    const chaveCliente = randomUUID();
    const providerRef = String(BigInt(Date.now()) * 1000000n + BigInt(Math.floor(Math.random() * 1000000)));
    const gerado = await prepararCheckoutAtomico({
      usuarioId: atleta.usuarioId,
      chaveCliente,
      modalidade: 'PIX_INDIVIDUAL',
      fingerprintRequisicao: fingerprintCheckout({ chaveCliente, teste: 'WEBHOOK_HTTP_AGUARDAR_QA' }),
      criarPagamento: (tx) => tx.pagamento.create({
        data: {
          usuarioId: atleta.usuarioId,
          plano: 'ATLETA_PRO',
          periodicidade: 'Mensal',
          metodo: 'PIX',
          status: 'PENDENTE',
          provider: 'MERCADOPAGO',
          providerRef,
          valor: '19.90',
          moeda: 'BRL',
          contextoKind: 'PERSONAL',
          contextoTipo: 'Atleta',
          meta: { qaWebhookHttp: true },
        },
      }),
    });
    pagamentoId = gerado.pagamento.id;
    operacaoId = gerado.operacao.id;
    assert.equal(await adquirirEnvioCheckout(operacaoId), true);
    assert.equal(await marcarCheckoutInconclusivo(operacaoId, new Error('QA_RESPOSTA_PERDIDA')), true);
    configurarConsultorMercadoPagoQa(async (id) => {
      contadorGet++;
      assert.equal(id, providerRef);
      return {
        id: providerRef,
        status: 'pending',
        status_detail: 'pending_waiting_payment',
        external_reference: pagamentoId!,
        metadata: { pagamentoId },
        transaction_amount: 19.90,
        currency_id: 'BRL',
      };
    });

    const app = express();
    app.use(express.json());
    app.use('/api/billing', billingRoutes);
    const iniciado = app.listen(0, '127.0.0.1');
    server = iniciado;
    if (!iniciado.listening) await new Promise<void>((resolve, reject) => {
      iniciado.once('listening', resolve); iniciado.once('error', reject);
    });
    const endereco = iniciado.address();
    assert.ok(endereco && typeof endereco !== 'string');
    const url = `http://127.0.0.1:${endereco.port}/api/billing/mercadopago/webhook?data.id=${providerRef}`;
    const enviar = async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = randomUUID();
      const manifesto = `id:${providerRef};request-id:${requestId};ts:${ts};`;
      const v1 = createHmac('sha256', process.env.MP_WEBHOOK_SECRET!).update(manifesto).digest('hex');
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          'x-signature': `ts=${ts},v1=${v1}`,
        },
        body: JSON.stringify({ type: 'payment', data: { id: providerRef } }),
      });
      return { status: resposta.status, corpo: await resposta.json() as Record<string, unknown> };
    };
    const primeira = await enviar();
    assert.equal(primeira.status, 200, JSON.stringify(primeira.corpo));
    assert.equal(primeira.corpo.conciliacaoPendente, true);
    console.log('✔ Webhook assinado passou pelo GET simulado e aguardou confirmação');
    const segunda = await enviar();
    assert.equal(segunda.status, 200, JSON.stringify(segunda.corpo));
    assert.equal(segunda.corpo.conciliacaoPendente, true);
    assert.equal(contadorGet, 2);
    console.log('✔ Reentrega consultou o mesmo pagamento sem novo envio');
    const pagamento = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
    const operacao = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: operacaoId } });
    assert.equal(pagamento.status, 'PENDENTE');
    assert.equal(pagamento.providerRef, providerRef);
    assert.equal(operacao.status, 'INCONCLUSIVA');
    assert.equal(operacao.pagamentoId, pagamentoId);
    assert.equal(await prisma.pagamentoBeneficio.count({ where: { pagamentoId } }), 0);
    assert.equal(await prisma.cupomResgate.count({ where: { pagamentoId } }), 0);
    console.log('✔ Nenhum benefício nem cupom consumido; checkout continua bloqueado');
    
    // TESTE 4: o provedor informa "approved",
    // mas o valor não corresponde ao pagamento.
    // A aprovação deve ser bloqueada.
    configurarConsultorMercadoPagoQa(async (id) => {
      contadorGet++;

      assert.equal(id, providerRef);

      return {
        id: providerRef,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId!,
        metadata: {
          pagamentoId,
        },
        transaction_amount: 0.01,
        currency_id: "BRL",
      };
    });

    const aprovacaoDivergente = await enviar();

    assert.equal(
      aprovacaoDivergente.status,
      503,
      JSON.stringify(aprovacaoDivergente.corpo)
    );

    const pagamentoDepois =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId },
      });

    const operacaoDepois =
      await prisma.billingCheckoutOperacao.findUniqueOrThrow({
        where: { id: operacaoId },
      });

    assert.equal(pagamentoDepois.status, "PENDENTE");
    assert.equal(operacaoDepois.status, "INCONCLUSIVA");

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      0
    );

    assert.equal(
      await prisma.cupomResgate.count({
        where: { pagamentoId },
      }),
      0
    );

    console.log(
      "✔ Aprovação com valor divergente bloqueada sem conceder acesso"
    );
    passou = true;
    console.log(
    '\nRESULTADO: 4/4 (aprovação divergente bloqueada; aprovação válida ainda pendente)'
    );
  } finally {
    try { configurarConsultorMercadoPagoQa(null); } catch {}
    if (server) {
      const s = server;
      await new Promise<void>((resolve, reject) => s.close(e => e ? reject(e) : resolve()));
    }
    try {
      if (passou && operacaoId && pagamentoId) {
        const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
        const op = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: operacaoId } });
        assert.equal(pg.status, 'PENDENTE');
        assert.equal(op.status, 'INCONCLUSIVA');
        assert.equal(await prisma.pagamentoBeneficio.count({ where: { pagamentoId } }), 0);
        assert.equal(await prisma.cupomReserva.count({ where: { pagamentoId } }), 0);
        await prisma.billingCheckoutOperacao.delete({ where: { id: operacaoId } });
        await prisma.pagamento.delete({ where: { id: pagamentoId } });
        console.log('[QA] Fixtures removidas');
      } else if (pagamentoId) {
        console.warn('[QA] Fixtures preservadas para auditoria', { pagamentoId, operacaoId });
      }
    } finally { await prisma.$disconnect(); }
  }
}
main().catch(e => { console.error('QA_WEBHOOK_INTEGRADO_FALHOU:', e); process.exitCode = 1; });