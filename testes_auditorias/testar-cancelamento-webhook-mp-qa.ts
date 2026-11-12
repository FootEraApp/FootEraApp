
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  // Validar ambiente ANTES de importar o controller.
  const rawUrl = process.env.DATABASE_URL ?? "";
  let db: URL;

  try {
    db = new URL(rawUrl);
  } catch {
    throw new Error("QA_DATABASE_URL_INVALID");
  }

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "SEGURANCA: teste permitido apenas no banco QA local, sem token Mercado Pago."
    );
  }

  const { prisma } = await import("./server/prisma.js");

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa",
      "Banco conectado não é o QA"
    );

    const {
      configurarConsultorMercadoPagoQa,
    } = await import(
      "./server/services/billingMercadoPagoGateway.js"
    );

    const {
      mercadoPagoWebhook,
    } = await import(
      "./server/controllers/billingController.js"
    );

    // Utiliza um usuário já existente somente
    // como referência FK no banco QA.
    const usuario = await prisma.usuario.findFirst({
      select: { id: true },
    });

    if (!usuario) {
      throw new Error(
        "Banco QA sem usuário. Prepare um usuário de teste antes de executar."
      );
    }

    const pagamentoId = randomUUID();
    const segundoPagamentoId = randomUUID();
    const mpId = String(
      BigInt(Date.now()) * 100000n + 12345n
    );
    const segundoMpId = String(
      BigInt(Date.now()) * 100000n + 12346n
    );

    const criados: string[] = [];
    let passou = 0;
    let falhou = 0;

    async function testar(
      descricao: string,
      acao: () => Promise<void>
    ) {
      try {
        await acao();
        passou++;
        console.log("✔", descricao);
      } catch (error) {
        falhou++;
        console.error("✖", descricao, error);
      }
    }

    async function chamarWebhook(id: string) {
      let status = 0;
      let corpo: any = null;
      
      const req = {
        query: {
          type: "payment",
          "data.id": id,
        },
        body: {
          type: "payment",
          data: {
            id,
          },
        },
      };

      const res = {
        status(value: number) {
          status = value;
          return this;
        },
        json(value: unknown) {
          corpo = value;
          return this;
        },
      };

      await mercadoPagoWebhook(
        req as any,
        res as any
      );

      return { status, corpo };
    }

    const retornoMp = (
      id: string,
      pagamentoInternoId: string,
      status: string,
      valor = 25
    ) => ({
      id,
      status,
      external_reference: pagamentoInternoId,
      metadata: {
        pagamentoId: pagamentoInternoId,
      },
      transaction_amount: valor,
      currency_id: "BRL",
    });

    try {
      // ======================================
      // CENÁRIO 1 — CANCELAMENTO CONFIRMADO
      // ======================================

      await prisma.pagamento.create({
        data: {
          id: pagamentoId,
          usuarioId: usuario.id,
          plano: "ATLETA_PRO",
          periodicidade: "Mensal",
          metodo: "PIX",
          status: "PENDENTE",
          valor: "25.00",
          moeda: "BRL",
          provider: "MERCADOPAGO",
          providerRef: `PREF-QA-${pagamentoId}`,
        },
      });
      criados.push(pagamentoId);

      configurarConsultorMercadoPagoQa(
        async () =>
          retornoMp(
            mpId,
            pagamentoId,
            "cancelled"
          )
      );

      await testar(
        "Cancelamento altera pagamento para CANCELADO",
        async () => {
          const resposta = await chamarWebhook(mpId);

          assert.equal(resposta.status, 200);

          assert.notEqual(
            resposta.corpo?.ignored,
            true,
            "O webhook foi ignorado em vez de processado"
          );

          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(pagamento.status, "CANCELADO");
          assert.equal(pagamento.providerRef, mpId);
          assert.ok(pagamento.canceladoEm);
        }
      );

      await testar(
        "Cancelamento não concede benefícios",
        async () => {
          const quantidade =
            await prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            });

          assert.equal(quantidade, 0);
        }
      );

      await testar(
        "Webhook de cancelamento repetido é idempotente",
        async () => {
          const resposta = await chamarWebhook(mpId);

          assert.equal(resposta.status, 200);
          assert.equal(resposta.corpo?.idempotent, true);

          const quantidade =
            await prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            });

          assert.equal(quantidade, 0);
        }
      );

      // ======================================
      // CENÁRIO 2 — APROVAÇÃO TARDIA
      // ======================================

      configurarConsultorMercadoPagoQa(
        async () =>
          retornoMp(
            mpId,
            pagamentoId,
            "approved"
          )
      );

      await testar(
        "Aprovação depois de cancelamento é bloqueada",
        async () => {
          const resposta = await chamarWebhook(mpId);

          assert.equal(resposta.status, 503);
          assert.equal(
            resposta.corpo?.code,
            "BILLING_MP_REQUIRES_RECONCILIATION"
          );

          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(pagamento.status, "CANCELADO");
        }
      );

      await testar(
        "Aprovação tardia não provisiona benefícios",
        async () => {
          const quantidade =
            await prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            });

          assert.equal(quantidade, 0);
        }
      );

      // ======================================
      // CENÁRIO 3 — VALOR DIVERGENTE
      // ======================================

      await prisma.pagamento.create({
        data: {
          id: segundoPagamentoId,
          usuarioId: usuario.id,
          plano: "ATLETA_PRO",
          periodicidade: "Mensal",
          metodo: "PIX",
          status: "PENDENTE",
          valor: "25.00",
          moeda: "BRL",
          provider: "MERCADOPAGO",
          providerRef: `PREF-QA-${segundoPagamentoId}`,
        },
      });
      criados.push(segundoPagamentoId);

      configurarConsultorMercadoPagoQa(
        async () =>
          retornoMp(
            segundoMpId,
            segundoPagamentoId,
            "approved",
            50
          )
      );

      await testar(
        "Valor divergente impede aprovação",
        async () => {
          const resposta =
            await chamarWebhook(segundoMpId);

          assert.equal(resposta.status, 503);
          assert.equal(
            resposta.corpo?.code,
            "BILLING_MP_REQUIRES_RECONCILIATION"
          );

          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: { id: segundoPagamentoId },
            });

          assert.equal(pagamento.status, "PENDENTE");
          assert.equal(
            pagamento.providerRef,
            `PREF-QA-${segundoPagamentoId}`
          );
        }
      );

      await testar(
        "Valor divergente não cria benefícios",
        async () => {
          const quantidade =
            await prisma.pagamentoBeneficio.count({
              where: {
                pagamentoId: segundoPagamentoId,
              },
            });

          assert.equal(quantidade, 0);
        }
      );
    } finally {
      configurarConsultorMercadoPagoQa(null);

      // Excluir SOMENTE os pagamentos criados
      // por esta execução do teste.
      if (criados.length > 0 && falhou === 0) {
        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: {
              pagamentoId: { in: criados },
            },
          });

        if (beneficios !== 0) {
          throw new Error(
            "QA_CLEANUP_ABORTADO: pagamentos com benefícios detectados"
          );
        }

        const pagamentosParaExcluir =
        await prisma.pagamento.findMany({
            where: {
            id: { in: criados },
            },
        });

        if (
        pagamentosParaExcluir.length !== criados.length ||
        pagamentosParaExcluir.some(
            (pagamento) =>
            pagamento.provider !== "MERCADOPAGO" ||
            pagamento.plano !== "ATLETA_PRO" ||
            pagamento.valor.toFixed(2) !== "25.00" ||
            !["CANCELADO", "PENDENTE"].includes(
                pagamento.status
            )
        )
        ) {
        throw new Error(
            "QA_CLEANUP_PAGAMENTOS_INCONSISTENTES"
        );
        }

        await prisma.pagamento.deleteMany({
          where: {
            id: { in: criados },
          },
        });
      }
      else if (criados.length > 0) {
        console.warn(
            "[QA] Falha detectada. Pagamentos preservados para auditoria:",
            criados
        );
        }
    }

    console.log(
      `\nRESULTADO: ${passou}/${passou + falhou}`
    );

    if (falhou > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("TESTE INTERROMPIDO:", error);
  process.exitCode = 1;
});