
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !== "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("AMBIENTE_QA_INVALIDO");
  }

  const { prisma } = await import("./server/prisma.js");

  const {
    prepararCheckoutAtomico,
    adquirirEnvioCheckout,
    marcarCheckoutInconclusivo,
    diagnosticarCheckoutInconclusivo,
    fingerprintCheckout,
  } = await import(
    "./server/services/billingCheckoutOperacaoService.js"
  );

  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;
  let aprovado = false;

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    console.log("✔ Banco QA confirmado");

    const atleta = await prisma.atleta.findFirst({
      select: {
        usuarioId: true,
      },
    });

    assert.ok(
      atleta,
      "QA_SEM_ATLETA_PARA_DIAGNOSTICO"
    );

    const chaveCliente = randomUUID();

    const providerRef = String(
      BigInt(Date.now()) * 1000000n +
      BigInt(Math.floor(Math.random() * 1000000))
    );

    const { pagamento, operacao } =
      await prepararCheckoutAtomico({
        usuarioId: atleta.usuarioId,
        chaveCliente,
        modalidade: "PIX_INDIVIDUAL",

        fingerprintRequisicao: fingerprintCheckout({
          teste: "DIAGNOSTICO_INCONCLUSIVO_QA",
          chaveCliente,
        }),

        criarPagamento: (tx) =>
          tx.pagamento.create({
            data: {
              usuarioId: atleta.usuarioId,
              plano: "ATLETA_PRO",
              periodicidade: "Mensal",
              metodo: "PIX",
              status: "PENDENTE",
              provider: "MERCADOPAGO",
              providerRef,
              valor: "19.90",
              moeda: "BRL",
              contextoKind: "PERSONAL",
              contextoTipo: "Atleta",
              meta: {
                qaDiagnosticoCheckout: true,
              },
            },
          }),
      });

    pagamentoId = pagamento.id;
    operacaoId = operacao.id;

    console.log("✔ Checkout e pagamento QA criados");

    assert.equal(
      await adquirirEnvioCheckout(operacaoId),
      true
    );

    console.log("✔ Envio adquirido uma única vez");

    assert.equal(
      await marcarCheckoutInconclusivo(
        operacaoId,
        new Error("QA_RESPOSTA_PERDIDA")
      ),
      true
    );

    console.log("✔ Checkout marcado INCONCLUSIVA");

    const diagnostico =
      await diagnosticarCheckoutInconclusivo(
        operacaoId
      );

    assert.equal(
      diagnostico.operacaoId,
      operacaoId
    );

    assert.equal(
      diagnostico.requerConciliacao,
      true
    );

    assert.equal(
      diagnostico.podeCriarOutraCobranca,
      false
    );

    assert.ok(
      diagnostico.metodoRecuperacao,
      "DIAGNOSTICO_SEM_METODO_RECUPERACAO"
    );

    console.log("✔ Diagnóstico exige conciliação");

    const operacaoDepois =
      await prisma.billingCheckoutOperacao.findUniqueOrThrow({
        where: {
          id: operacaoId,
        },
      });

    const pagamentoDepois =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: pagamentoId,
        },
      });

    assert.equal(
      operacaoDepois.status,
      "INCONCLUSIVA"
    );

    assert.equal(
      operacaoDepois.pagamentoId,
      pagamentoId
    );

    assert.equal(
      pagamentoDepois.status,
      "PENDENTE"
    );

    assert.equal(
      pagamentoDepois.providerRef,
      providerRef
    );

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      0
    );

    assert.equal(
      await prisma.cupomReserva.count({
        where: { pagamentoId },
      }),
      0
    );

    console.log(
      "✔ Diagnóstico preservou pagamento e checkout"
    );

    console.log(
      "✔ Nenhum benefício ou cupom criado"
    );

    aprovado = true;

    console.log("\nRESULTADO: 7/7");
  } finally {
    if (aprovado && pagamentoId && operacaoId) {
      await prisma.$transaction(async (tx) => {
        const operacao =
          await tx.billingCheckoutOperacao.findUniqueOrThrow({
            where: { id: operacaoId! },
          });

        const pagamento =
          await tx.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId! },
          });

        assert.equal(
          operacao.pagamentoId,
          pagamentoId
        );

        assert.equal(
          operacao.status,
          "INCONCLUSIVA"
        );

        assert.equal(
          pagamento.status,
          "PENDENTE"
        );

        assert.equal(
          await tx.pagamentoBeneficio.count({
            where: { pagamentoId: pagamentoId! },
          }),
          0
        );

        assert.equal(
          await tx.cupomReserva.count({
            where: { pagamentoId: pagamentoId! },
          }),
          0
        );

        await tx.billingCheckoutOperacao.delete({
          where: { id: operacaoId! },
        });

        await tx.pagamento.delete({
          where: { id: pagamentoId! },
        });
      });

      console.log("[QA] Fixtures removidas");
    } else if (pagamentoId) {
      console.warn(
        "[QA] Fixture preservada para auditoria:",
        { pagamentoId, operacaoId }
      );
    }

    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("DIAGNOSTICO_CHECKOUT_QA_FALHOU:", erro);
  process.exitCode = 1;
});