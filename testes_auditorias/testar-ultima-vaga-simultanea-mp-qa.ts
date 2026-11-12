import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  let db: URL;
  try { db = new URL(process.env.DATABASE_URL ?? ''); }
  catch { throw new Error('QA_ABORTADO: DATABASE_URL inválida'); }
  if (process.env.NODE_ENV === 'production' || Boolean(process.env.MP_ACCESS_TOKEN) ||
      process.env.BILLING_CUPOM_RESERVA_QA !== 'true' ||
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== 'false' ||
      process.env.ENABLE_BILLING_SCHEDULER !== 'false' ||
      db.protocol !== 'postgresql:' || !['localhost','127.0.0.1'].includes(db.hostname) ||
      db.port !== '5433' || db.pathname !== '/footera_billing_qa') {
    throw new Error('QA_ABORTADO: somente PostgreSQL local footera_billing_qa');
  }

  const { prisma } = await import('./server/prisma.js');
  const eventoId = randomUUID();
  const compras = [0, 1].map((i) => ({
    usuarioId: '', pagamentoId: randomUUID(),
    mpId: (BigInt(Date.now()) * 100000n + BigInt(69001 + i)).toString(),
  }));
  let eventoCriado = false;
  const pagamentosCriados = new Set<string>();
  let mockConfigurado = false;
  let passou = 0, falhou = 0;
  const verificar = async (nome: string, fn: () => Promise<void>) => {
    try { await fn(); passou++; console.log('✔', nome); }
    catch (erro) { falhou++; console.error('✖', nome, erro); }
  };

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, 'footera_billing_qa');
    const atletas = await prisma.atleta.findMany({ select: { usuarioId: true }, take: 200 });
    const ids = [...new Set(atletas.map((a) => a.usuarioId))].slice(0, 2);
    assert.equal(ids.length, 2, 'QA_SEM_DOIS_ATLETAS');
    compras.forEach((c, i) => { c.usuarioId = ids[i]; });

    await prisma.evento.create({ data: {
      id: eventoId, titulo: `QA Simultaneo ${eventoId}`,
      descricao: 'Fixture temporária de concorrência', status: 'ABERTO',
      dataEvento: new Date(Date.now() + 10 * 86400000),
      inscricaoInicio: new Date(Date.now() - 86400000),
      inscricaoFim: new Date(Date.now() + 9 * 86400000),
      vagas: 1, valorInscricao: '25.00', requisitos: [], linkInscricao: null,
    }});
    eventoCriado = true;

    const { assertEventoDisponivelParaCompra, mercadoPagoWebhook } =
      await import('./server/controllers/billingController.js');
    const { configurarConsultorMercadoPagoQa } =
      await import('./server/services/billingMercadoPagoGateway.js');

    await verificar('Ambos elegíveis antes da confirmação', async () => {
      for (const c of compras) {
        const ev = await assertEventoDisponivelParaCompra(`EVENTO:${eventoId}`, c.usuarioId);
        assert.equal(ev.id, eventoId);
      }
    });

    for (const c of compras) {
      await prisma.pagamento.create({ data: {
        id: c.pagamentoId, usuarioId: c.usuarioId,
        plano: `EVENTO:${eventoId}`, periodicidade: 'Mensal', metodo: 'PIX',
        status: 'PENDENTE', valor: '25.00', moeda: 'BRL',
        provider: 'MERCADOPAGO', providerRef: `PREF-QA-${c.pagamentoId}`,
        contextoKind: 'PERSONAL', contextoTipo: 'Atleta', contextoPerfilId: null,
      }});
      pagamentosCriados.add(c.pagamentoId);
    }

    // Um ÚNICO mock para ambas as consultas. Não reconfigurar dentro do webhook.
    configurarConsultorMercadoPagoQa(async (id) => {
      const c = compras.find((x) => x.mpId === String(id));
      if (!c) throw new Error(`QA_MP_ID_DESCONHECIDO: ${id}`);
      return {
        id: c.mpId, status: 'approved', status_detail: 'accredited',
        external_reference: c.pagamentoId, metadata: { pagamentoId: c.pagamentoId },
        transaction_amount: 25, currency_id: 'BRL',
      };
    });
    mockConfigurado = true;

    async function webhook(c: typeof compras[number]) {
      let status = 0; let corpo: any = null;
      const req = { query: { 'data.id': c.mpId }, body: { data: { id: c.mpId } } };
      const res = {
        status(n: number) { status = n; return this; },
        json(v: unknown) { corpo = v; return this; },
      };
      try {
        await mercadoPagoWebhook(req as any, res as any);
        return { usuarioId: c.usuarioId, pagamentoId: c.pagamentoId, status, corpo };
      } catch (erro) {
        return { usuarioId: c.usuarioId, pagamentoId: c.pagamentoId,
          status: -1, corpo: { erro: String(erro) } };
      }
    }

    console.log('[QA] Iniciando DOIS webhooks ao mesmo tempo...');
    const resultados = await Promise.all(compras.map(webhook));
    console.log('[QA] Respostas:', resultados);
    const vencedores = resultados.filter((r) => r.status === 200 && r.corpo?.ok === true);
    const perdedores = resultados.filter((r) =>
      r.status === 503 &&
      r.corpo?.code === 'BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED');
    const inscricoes = await prisma.inscricaoEvento.findMany({
      where: { eventoId, status: 'CONFIRMADA' }, select: { usuarioId: true },
    });
    const beneficios = await prisma.pagamentoBeneficio.findMany({
      where: { pagamentoId: { in: compras.map((c) => c.pagamentoId) }, tipo: 'EVENTO' },
    });
    const pagamentos = await prisma.pagamento.findMany({
      where: { id: { in: compras.map((c) => c.pagamentoId) } },
      select: { id: true, status: true, providerRef: true },
    });
    const auditorias = await prisma.auditLog.findMany({
      where: {
        acao: 'BILLING_EVENT_CAPACITY_RECONCILIATION',
        entidade: 'Pagamento', entidadeId: { in: compras.map((c) => c.pagamentoId) },
      },
    });

    await verificar('Uma única resposta de sucesso e uma de conciliação', async () => {
      assert.equal(vencedores.length, 1, JSON.stringify(resultados));
      assert.equal(perdedores.length, 1, JSON.stringify(resultados));
    });
    await verificar('A última vaga é ocupada somente uma vez', async () => {
      assert.equal(inscricoes.length, 1);
      assert.equal(inscricoes[0].usuarioId, vencedores[0]?.usuarioId);
    });
    await verificar('Apenas um benefício de evento foi concedido', async () => {
      assert.equal(beneficios.length, 1);
      assert.equal(beneficios[0].pagamentoId, vencedores[0]?.pagamentoId);
    });
    await verificar('Pagamento vencedor aprovado, perdedor pendente', async () => {
      assert.equal(pagamentos.length, 2);
      assert.equal(pagamentos.find((p) => p.id === vencedores[0]?.pagamentoId)?.status, 'APROVADO');
      const pgPerdedor = pagamentos.find((p) => p.id === perdedores[0]?.pagamentoId);
      assert.equal(pgPerdedor?.status, 'PENDENTE');
      assert.equal(pgPerdedor?.providerRef, compras.find((c) => c.pagamentoId === pgPerdedor?.id)?.mpId);
    });
    await verificar('Cobrança excedente registrada para conciliação', async () => {
      assert.equal(auditorias.length, 1);
      assert.equal(auditorias[0].entidadeId, perdedores[0]?.pagamentoId);
    });
    await verificar('Não há benefício do pagamento excedente', async () => {
      assert.equal(beneficios.some((b) => b.pagamentoId === perdedores[0]?.pagamentoId), false);
    });
    
    await verificar(
      "Pagamento perdedor possui uma unica pendencia",
      async () => {
        const pagamentoId = perdedores[0]?.pagamentoId;

        assert.ok(
          pagamentoId,
          "QA_PAGAMENTO_PERDEDOR_NAO_IDENTIFICADO"
        );

        const pendencias =
          await prisma.billingPendenciaEvento.findMany({
            where: { pagamentoId },
          });

        assert.equal(pendencias.length, 1);
        assert.equal(pendencias[0].eventoId, eventoId);
        assert.equal(
          pendencias[0].motivo,
          "BILLING_EVENT_CAPACITY_EXCEEDED"
        );
        assert.equal(
          pendencias[0].status,
          "PENDENTE_ANALISE"
        );
        assert.equal(
          pendencias[0].valor.toFixed(2),
          "25.00"
        );
      }
    );

    await verificar(
      "Concorrencia nao inicia estorno automatico",
      async () => {
        const pagamentoId = perdedores[0]?.pagamentoId;

        assert.ok(pagamentoId);

        const [
          compensacoes,
          beneficiosPerdedor,
          pagamento,
        ] = await Promise.all([
          prisma.billingCompensacaoEvento.count({
            where: { pagamentoId },
          }),
          prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          }),
          prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          }),
        ]);

        assert.equal(compensacoes, 0);
        assert.equal(beneficiosPerdedor, 0);
        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.reembolsadoEm, null);
      }
    );
  } finally {
    try {
      if (mockConfigurado) {
        const { configurarConsultorMercadoPagoQa } =
          await import('./server/services/billingMercadoPagoGateway.js');
        configurarConsultorMercadoPagoQa(null);
      }
      if (eventoCriado && falhou === 0) {
        await prisma.$transaction(async (tx) => {
          const ids = [...pagamentosCriados];
          const pagamentos = await tx.pagamento.findMany({ where: { id: { in: ids } } });
          if (pagamentos.length !== ids.length || pagamentos.some((p) =>
            p.plano !== `EVENTO:${eventoId}` || p.provider !== 'MERCADOPAGO')) {
            throw new Error('QA_CLEANUP_ABORTADO: pagamento inesperado');
          }
          const externas = await tx.inscricaoEvento.count({
            where: { eventoId, usuarioId: { notIn: compras.map((c) => c.usuarioId) } },
          });
          if (externas) throw new Error('QA_CLEANUP_ABORTADO: inscrições externas');
          await tx.billingPendenciaEvento.deleteMany({
            where: {
                pagamentoId: {
                in: ids,
                },
            },
            });
          await tx.auditLog.deleteMany({ where: {
            acao: 'BILLING_EVENT_CAPACITY_RECONCILIATION',
            entidade: 'Pagamento', entidadeId: { in: ids },
          }});
          await tx.pagamentoBeneficio.deleteMany({ where: { pagamentoId: { in: ids } } });
          await tx.inscricaoEvento.deleteMany({ where: { eventoId } });
          for (const id of ids) await tx.pagamento.delete({ where: { id } });
          await tx.evento.delete({ where: { id: eventoId } });
        });
        console.log('[QA] Evento, inscrições, auditoria, benefícios e pagamentos temporários removidos.');
      }
      else if (eventoCriado) {
        console.warn(
            "[QA] Falha detectada. Fixture preservada:",
            {
            eventoId,
            pagamentoIds: [...pagamentosCriados],
            }
        );
        }
    } finally { await prisma.$disconnect(); }
  }
  console.log(`\nRESULTADO: ${passou}/${passou + falhou}`);
  if (falhou) process.exitCode = 1;
}
main().catch((e) => { console.error('TESTE INTERROMPIDO:', e); process.exitCode = 1; });