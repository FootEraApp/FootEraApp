import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ''); }
  catch { throw new Error('QA_ABORTADO: DATABASE_URL invalida'); }
  if (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== 'true' ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== 'false' ||
    process.env.ENABLE_BILLING_SCHEDULER !== 'false' ||
    url.protocol !== 'postgresql:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '5433' ||
    url.pathname !== '/footera_billing_qa'
  ) throw new Error('QA_ABORTADO: somente banco local footera_billing_qa');

  const { prisma } = await import('./server/prisma.js');
  const eventoId = randomUUID();
  const compras = [0, 1].map((i) => ({
    usuarioId: '',
    pagamentoId: randomUUID(),
    mpId: (BigInt(Date.now()) * 100000n + BigInt(87001 + i)).toString(),
  }));
  let fixtureEvento = false;
  const pagamentosCriados = new Set<string>();
  let passou = 0, falhou = 0;

  async function verificar(nome: string, fn: () => Promise<void>) {
    try { await fn(); passou++; console.log('✔', nome); }
    catch (e) { falhou++; console.error('✖', nome, e); }
  }

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, 'footera_billing_qa');
    const atletas = await prisma.atleta.findMany({
      select: { usuarioId: true }, take: 100,
    });
    const ids = [...new Set(atletas.map((a) => a.usuarioId))].slice(0, 2);
    assert.equal(ids.length, 2, 'QA_SEM_DOIS_ATLETAS');
    compras.forEach((c, i) => c.usuarioId = ids[i]);

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Ultima Vaga ${eventoId}`,
        descricao: 'Fixture temporaria do teste de lotacao',
        status: 'ABERTO',
        dataEvento: new Date(Date.now() + 10 * 86400000),
        inscricaoInicio: new Date(Date.now() - 86400000),
        inscricaoFim: new Date(Date.now() + 9 * 86400000),
        vagas: 1,
        valorInscricao: '25.00',
        requisitos: [],
        linkInscricao: null,
      },
    });
    fixtureEvento = true;
    const plano = `EVENTO:${eventoId}`;

    const { assertEventoDisponivelParaCompra, mercadoPagoWebhook } =
      await import('./server/controllers/billingController.js');
    const { configurarConsultorMercadoPagoQa } =
      await import('./server/services/billingMercadoPagoGateway.js');

    await verificar('Antes do pagamento, ambos veem a vaga disponivel', async () => {
      for (const c of compras) {
        const ev = await assertEventoDisponivelParaCompra(plano, c.usuarioId);
        assert.equal(ev.id, eventoId);
      }
    });

    for (const c of compras) {
      await prisma.pagamento.create({
        data: {
          id: c.pagamentoId, usuarioId: c.usuarioId,
          plano, periodicidade: 'Mensal', metodo: 'PIX',
          status: 'PENDENTE', valor: '25.00', moeda: 'BRL',
          provider: 'MERCADOPAGO', providerRef: `PREF-QA-${c.pagamentoId}`,
          contextoKind: 'PERSONAL', contextoTipo: 'Atleta',
          contextoPerfilId: null,
        },
      });
      pagamentosCriados.add(c.pagamentoId);
    }

    async function webhook(c: typeof compras[number]) {
      configurarConsultorMercadoPagoQa(async (id) => {
        assert.equal(id, c.mpId);
        return {
          id: c.mpId, status: 'approved', status_detail: 'accredited',
          external_reference: c.pagamentoId,
          metadata: { pagamentoId: c.pagamentoId },
          transaction_amount: 25,
          currency_id: 'BRL',
        };
      });
      let status = 0;
      let corpo: any = null;
      const req = {
        query: { 'data.id': c.mpId }, body: { data: { id: c.mpId } },
      };
      const res = {
        status(n: number) { status = n; return this; },
        json(v: unknown) { corpo = v; return this; },
      };
      await mercadoPagoWebhook(req as any, res as any);
      return { status, corpo };
    }

    try {
      const primeiro = await webhook(compras[0]);
      console.log('[QA] Primeiro webhook:', primeiro);
      await verificar('Primeiro pagamento recebe a ultima vaga', async () => {
        assert.equal(primeiro.status, 200);
        assert.equal((await prisma.inscricaoEvento.count({
          where: { eventoId, status: 'CONFIRMADA' },
        })), 1);
      });

      const segundo = await webhook(compras[1]);
      assert.equal(segundo.status, 503);

        assert.equal(
        segundo.corpo?.code,
        "BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED"
        );
      console.log('[QA] Segundo webhook (pagamento externo ja aprovado):', segundo);
      const inscritos = await prisma.inscricaoEvento.findMany({
        where: { eventoId, status: 'CONFIRMADA' },
        select: { usuarioId: true },
      });
      const pagamentos = await prisma.pagamento.findMany({
        where: { id: { in: compras.map((c) => c.pagamentoId) } },
        select: { id: true, status: true },
      });
      console.log('[QA] Inscritos confirmados:', inscritos.length, '/', 1);
      console.log('[QA] Pagamentos:', pagamentos);

      await verificar('Ultima vaga nao ultrapassa lotacao apos segundo webhook', async () => {
        assert.ok(inscritos.length <= 1,
          `OVERBOOKING_DETECTADO: ${inscritos.length} inscritos para 1 vaga`);
      });
      await verificar('Segundo comprador nao recebe inscricao confirmada', async () => {
        assert.equal(inscritos.some((i) => i.usuarioId === compras[1].usuarioId), false,
          'OVERBOOKING_DETECTADO: segundo usuario recebeu inscricao');
      });
      await verificar('Nao concede dois beneficios de evento para uma vaga', async () => {
        const beneficios = await prisma.pagamentoBeneficio.count({
          where: { pagamentoId: { in: compras.map((c) => c.pagamentoId) }, tipo: 'EVENTO' },
        });
        assert.ok(beneficios <= 1, `OVERBOOKING_BENEFICIOS: ${beneficios}`);
      });
      
      await verificar(
        "Pagamento excedente fica pendente de conciliacao",
        async () => {
          const segundoPagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: {
                id: compras[1].pagamentoId,
              },
            });

          // O dinheiro já foi confirmado externamente.
          // A aprovação local foi revertida para não
          // registrar uma compra entregue sem vaga.
          assert.equal(
            segundoPagamento.status,
            "PENDENTE"
          );

          assert.equal(
            segundoPagamento.providerRef,
            compras[1].mpId
          );

          const auditoria =
            await prisma.auditLog.findFirst({
              where: {
                acao:
                  "BILLING_EVENT_CAPACITY_RECONCILIATION",
                entidade: "Pagamento",
                entidadeId:
                  compras[1].pagamentoId,
              },
            });

          assert.ok(
            auditoria,
            "Pagamento excedente sem auditoria"
          );
        }
      );
      
      await verificar(
        "Excedente possui exatamente uma pendencia financeira",
        async () => {
          const pendencias =
            await prisma.billingPendenciaEvento.findMany({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          assert.equal(pendencias.length, 1);

          const pendencia = pendencias[0];

          assert.equal(pendencia.eventoId, eventoId);
          assert.equal(
            pendencia.motivo,
            "BILLING_EVENT_CAPACITY_EXCEEDED"
          );
          assert.equal(
            pendencia.status,
            "PENDENTE_ANALISE"
          );
          assert.equal(
            pendencia.providerRef,
            compras[1].mpId
          );
          assert.equal(pendencia.moeda, "BRL");
          assert.equal(pendencia.valor.toFixed(2), "25.00");
        }
      );

      await verificar(
        "Excedente nao cria compensacao ou reembolso",
        async () => {
          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: {
                id: compras[1].pagamentoId,
              },
            });

          const compensacoes =
            await prisma.billingCompensacaoEvento.count({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          const beneficios =
            await prisma.pagamentoBeneficio.count({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          assert.equal(pagamento.status, "PENDENTE");
          assert.equal(pagamento.reembolsadoEm, null);
          assert.equal(compensacoes, 0);
          assert.equal(beneficios, 0);
        }
      );
    } finally {
      configurarConsultorMercadoPagoQa(null);
    }
  } finally {
    try {
      // Todas as entidades abaixo possuem IDs exclusivos desta execucao.
      // A limpeza ocorre mesmo quando detectamos overbooking.
      if (fixtureEvento) {
        await prisma.$transaction(async (tx) => {
          const ids = compras.map((c) => c.pagamentoId);
          const pg = await tx.pagamento.findMany({ where: { id: { in: ids } } });
          if (pg.length !== pagamentosCriados.size ||
              pg.some((p) => p.plano !== `EVENTO:${eventoId}` || p.provider !== 'MERCADOPAGO')) {
            throw new Error('QA_CLEANUP_ABORTADO: pagamento inesperado');
          }
          await tx.billingPendenciaEvento.deleteMany({
            where: {
                pagamentoId: {
                in: ids,
                },
            },
            });
          await tx.auditLog.deleteMany({
            where: {
                acao:
                "BILLING_EVENT_CAPACITY_RECONCILIATION",
                entidade: "Pagamento",
                entidadeId: {
                in: ids,
                },
            },
            });
          await tx.pagamentoBeneficio.deleteMany({ where: { pagamentoId: { in: ids } } });
          await tx.inscricaoEvento.deleteMany({ where: { eventoId, usuarioId: { in: compras.map((c) => c.usuarioId) } } });
          for (const id of pagamentosCriados) await tx.pagamento.delete({ where: { id } });
          await tx.evento.delete({ where: { id: eventoId } });
        });
        console.log('[QA] Evento, inscricoes, beneficios e pagamentos temporarios removidos.');
      }
    } finally {
      await prisma.$disconnect();
    }
  }
  console.log(`\nRESULTADO: ${passou}/${passou + falhou}`);
  if (falhou) process.exitCode = 1;
}
main().catch((e) => { console.error('TESTE INTERROMPIDO:', e); process.exitCode = 1; });