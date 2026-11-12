
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !==
      "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !==
      "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !==
      "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      url.hostname
    ) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "QA_ABORTADO: ambiente fora do banco local autorizado"
    );
  }

  const { prisma } = await import(
    "./server/prisma.js"
  );

  const {
    registrarPendenciaEventoExcedente,
  } = await import(
    "./server/services/billingPendenciaEventoService.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();

  let eventoCriado = false;
  let pagamentoCriado = false;
  let passou = 0;

  async function check(
    nome: string,
    fn: () => Promise<void>
  ) {
    await fn();
    passou++;

    console.log("✔", nome);
  }

  try {
    // Confirmar o banco antes de criar fixtures.
    const db = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(
      db[0]?.nome,
      "footera_billing_qa"
    );

    // Reutilizar somente o ID de um atleta QA.
    // Nenhum dado dele sera alterado.
    const atleta =
      await prisma.atleta.findFirst({
        select: {
          usuarioId: true,
        },
      });

    assert.ok(
      atleta,
      "Banco QA precisa de um atleta para criar o pagamento"
    );

    // ========================================
    // CRIAR EVENTO TEMPORARIO
    // ========================================

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA pendencia ${eventoId}`,
        descricao: "Evento temporario",
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

    // Criar pagamento externo simulado.
    const providerRef =
      String(Date.now()) + "21997";

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
        providerRef,

        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
      },
    });

    pagamentoCriado = true;

    // ========================================
    // TESTE 1 — CRIAR PENDENCIA
    // ========================================

    await check(
      "Registrar pendencia sem aprovar pagamento",
      async () => {
        const p =
          await registrarPendenciaEventoExcedente({
            pagamentoId,
            eventoId,
          });

        assert.equal(
          p.status,
          "PENDENTE_ANALISE"
        );

        assert.equal(
          p.providerRef,
          providerRef
        );

        assert.equal(
          p.pagamentoId,
          pagamentoId
        );
      }
    );

    // ========================================
    // TESTE 2 — CONCORRENCIA
    // ========================================

    await check(
      "Repeticao concorrente nao duplica pendencia",
      async () => {
        const resultados =
          await Promise.all(
            Array.from(
              { length: 6 },
              () =>
                registrarPendenciaEventoExcedente({
                  pagamentoId,
                  eventoId,
                })
            )
          );

        assert.equal(
          new Set(
            resultados.map((x) => x.id)
          ).size,
          1
        );

        const total =
          await prisma.billingPendenciaEvento.count({
            where: {
              pagamentoId,
            },
          });

        assert.equal(total, 1);
      }
    );

    // ========================================
    // TESTE 3 — EVENTO DIVERGENTE
    // ========================================

    await check(
      "Identidade de evento divergente e recusada",
      async () => {
        await assert.rejects(
          () =>
            registrarPendenciaEventoExcedente({
              pagamentoId,
              eventoId: randomUUID(),
            }),
          /BILLING_EVENT_PENDING_RECONCILIATION_INVALID_PAYMENT/
        );
      }
    );

    // ========================================
    // TESTE 4 — NAO CONCEDER ACESSO
    // ========================================

    await check(
      "Pagamento segue pendente e sem beneficio ou inscricao",
      async () => {
        const pg =
          await prisma.pagamento.findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });

        assert.equal(
          pg.status,
          "PENDENTE"
        );

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: {
              pagamentoId,
            },
          });

        assert.equal(beneficios, 0);

        const inscricoes =
          await prisma.inscricaoEvento.count({
            where: {
              eventoId,
            },
          });

        assert.equal(inscricoes, 0);
      }
    );
  } finally {
    try {
      // Limpeza protegida:
      // somente IDs criados nesta execucao.
      if (pagamentoCriado) {
        const pg =
          await prisma.pagamento.findUnique({
            where: {
              id: pagamentoId,
            },
          });

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: {
              pagamentoId,
            },
          });

        const inscricoes =
          await prisma.inscricaoEvento.count({
            where: {
              eventoId,
            },
          });

        if (
          pg &&
          pg.status === "PENDENTE" &&
          pg.plano ===
            `EVENTO:${eventoId}` &&
          beneficios === 0 &&
          inscricoes === 0
        ) {
          await prisma.$transaction(
            async (tx) => {
              await tx.billingPendenciaEvento.deleteMany({
                where: {
                  pagamentoId,
                },
              });

              await tx.pagamento.delete({
                where: {
                  id: pagamentoId,
                },
              });
            }
          );

          console.log(
            "[QA] Pendencia e pagamento temporarios removidos"
          );
        } else {
          console.warn(
            "[QA] Pagamento preservado: estado inesperado",
            pagamentoId
          );
        }
      }

      if (eventoCriado) {
        const pagamentosRestantes =
          await prisma.pagamento.count({
            where: {
              plano: `EVENTO:${eventoId}`,
            },
          });

        const inscricoesRestantes =
          await prisma.inscricaoEvento.count({
            where: {
              eventoId,
            },
          });

        if (
          pagamentosRestantes === 0 &&
          inscricoesRestantes === 0
        ) {
          await prisma.evento.delete({
            where: {
              id: eventoId,
            },
          });

          console.log(
            "[QA] Evento temporario removido"
          );
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    `\nRESULTADO: ${passou}/4`
  );
}

main().catch((erro) => {
  console.error(
    "TESTE INTERROMPIDO:",
    erro
  );

  process.exitCode = 1;
});