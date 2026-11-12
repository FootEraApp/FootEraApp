
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const {
    prepararCompensacaoEventoVerificada,
    } = await import(
    "./server/services/billingCompensacaoEventoVerificadaService.js"
    );

    const {
    configurarConsultorMercadoPagoQa,
    } = await import(
    "./server/services/billingMercadoPagoGateway.js"
    );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const mpId = `${Date.now()}97531`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let aprovados = 0;
  let falhou = false;

  async function verificar(
    nome: string,
    fn: () => Promise<void>
  ) {
    await fn();
    aprovados++;
    console.log("✔", nome);
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Compensacao ${eventoId}`,
        descricao: "Fixture temporaria",
        status: "ABERTO",
        dataEvento: new Date(
          Date.now() + 10 * 86400000
        ),
        inscricaoInicio: new Date(
          Date.now() - 86400000
        ),
        inscricaoFim: new Date(
          Date.now() + 9 * 86400000
        ),
        vagas: 1,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

    eventoCriado = true;

    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId: atleta.usuarioId,
        plano: `EVENTO:${eventoId}`,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "25.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: mpId,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
      },
    });

    pagamentoCriado = true;

    await prisma.billingPendenciaEvento.create({
      data: {
        pagamentoId,
        eventoId,
        motivo: "BILLING_EVENT_CAPACITY_EXCEEDED",
        status: "PENDENTE_ANALISE",
        providerRef: mpId,
        valor: "25.00",
        moeda: "BRL",
      },
    });

    configurarConsultorMercadoPagoQa(async (id) => {
        assert.equal(id, mpId);

        return {
            id: mpId,
            status: "approved",
            status_detail: "accredited",
            external_reference: pagamentoId,
            metadata: {
            pagamentoId,
            },
            transaction_amount: 25,
            currency_id: "BRL",
        };
        });

    await verificar(
      "Prepara compensacao sem alterar pagamento",
      async () => {
        const resultado =
          await prepararCompensacaoEventoVerificada(pagamentoId);

        assert.equal(resultado.criadaAgora, true);
        assert.equal(
        resultado.verificacao.statusMp,
        "approved"
        );

        assert.equal(
        resultado.verificacao.motivo,
        "CANDIDATA_A_ANALISE_DE_ESTORNO"
        );

        assert.equal(
        resultado.verificacao.estornoExecutado,
        false
        );
        assert.equal(
          resultado.compensacao.status,
          "PREPARADA"
        );
        assert.equal(
          resultado.compensacao.pagamentoId,
          pagamentoId
        );

        const pg =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pg.status, "PENDENTE");
      }
    );

    await verificar(
      "Seis chamadas simultaneas reutilizam a compensacao",
      async () => {
        const resultados = await Promise.all(
          Array.from(
            { length: 6 },
            () => prepararCompensacaoEventoVerificada(pagamentoId)
          )
        );

        assert.equal(
          new Set(
            resultados.map(
              (r) => r.compensacao.id
            )
          ).size,
          1
        );

        assert.ok(
          resultados.every(
            (r) => r.criadaAgora === false
          )
        );
      }
    );

    await verificar(
      "Chave de idempotencia e estavel",
      async () => {
        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(
          c.chaveIdempotencia,
          `footera-evento-refund-${pagamentoId}`
        );

        assert.equal(
          c.tentativas,
          0
        );

        assert.equal(
          c.confirmadoEm,
          null
        );
      }
    );

    await verificar(
      "Existe somente uma compensacao",
      async () => {
        const total =
          await prisma.billingCompensacaoEvento.count({
            where: { pagamentoId },
          });

        assert.equal(total, 1);
      }
    );

    await verificar(
      "Compensacao nao concede acesso ou estorna",
      async () => {
        const [beneficios, inscricoes, pg, pendencia] =
          await Promise.all([
            prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            }),
            prisma.inscricaoEvento.count({
              where: { eventoId },
            }),
            prisma.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            }),
            prisma.billingPendenciaEvento.findUniqueOrThrow({
              where: { pagamentoId },
            }),
          ]);

        assert.equal(beneficios, 0);
        assert.equal(inscricoes, 0);
        assert.equal(pg.reembolsadoEm, null);
        assert.equal(pg.status, "PENDENTE");
        assert.equal(
          pendencia.status,
          "PENDENTE_ANALISE"
        );
      }
    );
    
    // ========================================
    // NEGATIVO 1 — PAGAMENTO EXTERNO PENDENTE
    // ========================================

    await verificar(
    "Pagamento pendente no MP nao permite preparacao",
    async () => {
        configurarConsultorMercadoPagoQa(
        async () => ({
            id: mpId,
            status: "pending",
            status_detail: "pending_waiting_payment",
            external_reference: pagamentoId,
            metadata: { pagamentoId },
            transaction_amount: 25,
            currency_id: "BRL",
        })
        );

        await assert.rejects(
        () =>
            prepararCompensacaoEventoVerificada(
            pagamentoId
            ),
        /BILLING_COMPENSACAO_NAO_ELEGIVEL/
        );
    }
    );

    // ========================================
    // NEGATIVO 2 — VALOR DIVERGENTE
    // ========================================

    await verificar(
    "Valor divergente no MP bloqueia preparacao",
    async () => {
        configurarConsultorMercadoPagoQa(
        async () => ({
            id: mpId,
            status: "approved",
            status_detail: "accredited",
            external_reference: pagamentoId,
            metadata: { pagamentoId },
            transaction_amount: 20,
            currency_id: "BRL",
        })
        );

        await assert.rejects(
        () =>
            prepararCompensacaoEventoVerificada(
            pagamentoId
            ),
        /BILLING_COMPENSACAO_NAO_ELEGIVEL/
        );
    }
    );

    // ========================================
    // NEGATIVO 3 — IDENTIDADE DIVERGENTE
    // ========================================

    await verificar(
    "Identidade divergente no MP bloqueia preparacao",
    async () => {
        configurarConsultorMercadoPagoQa(
        async () => ({
            id: mpId,
            status: "approved",
            status_detail: "accredited",
            external_reference: randomUUID(),
            metadata: { pagamentoId },
            transaction_amount: 25,
            currency_id: "BRL",
        })
        );

        await assert.rejects(
        () =>
            prepararCompensacaoEventoVerificada(
            pagamentoId
            ),
        /BILLING_COMPENSACAO_NAO_ELEGIVEL/
        );
    }
    );

  } catch (erro) {
    falhou = true;
    throw erro;
  } finally {
    try {
        configurarConsultorMercadoPagoQa(null);

        if (pagamentoCriado && !falhou) {
        await prisma.$transaction(async (tx) => {
          const pg = await tx.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

          const beneficios =
            await tx.pagamentoBeneficio.count({
              where: { pagamentoId },
            });

          const inscricoes =
            await tx.inscricaoEvento.count({
              where: { eventoId },
            });

          const c =
            await tx.billingCompensacaoEvento.findUnique({
              where: { pagamentoId },
            });

          if (
            pg.plano !== `EVENTO:${eventoId}` ||
            pg.status !== "PENDENTE" ||
            pg.provider !== "MERCADOPAGO" ||
            beneficios !== 0 ||
            inscricoes !== 0 ||
            (
              c &&
              (
                c.status !== "PREPARADA" ||
                c.tentativas !== 0 ||
                c.confirmadoEm !== null
              )
            )
          ) {
            throw new Error(
              "QA_LIMPEZA_BLOQUEADA_ESTADO_INESPERADO"
            );
          }

          await tx.billingCompensacaoEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.billingPendenciaEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });
      }

      if (eventoCriado && !falhou) {
        const pagamentos =
          await prisma.pagamento.count({
            where: {
              plano: `EVENTO:${eventoId}`,
            },
          });

        if (pagamentos === 0) {
          await prisma.evento.delete({
            where: { id: eventoId },
          });
        }
      }

      if (falhou) {
        console.warn(
          "[QA] Falha detectada. Dados preservados:",
          { eventoId, pagamentoId }
        );
      } else {
        console.log(
          "[QA] Compensacao, pendencia, pagamento e evento removidos."
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\nRESULTADO: ${aprovados}/8`);
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});