
import assert from "node:assert/strict";

async function main() {
  const pagamentoId = process.argv[2];
  const motivoEsperado = process.argv[3];

  const motivosPermitidos = [
    "CHAVE_RESERVADA_SEM_ENVIO_REGISTRADO",
    "RESULTADO_DESCONHECIDO_BLOQUEADO",
    "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO",
    ];

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
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  assert.match(
    pagamentoId ?? "",
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  );

  assert.ok(
    motivosPermitidos.includes(motivoEsperado),
    "QA_MOTIVO_INVALIDO"
  );

  const { prisma } = await import("./server/prisma.js");

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const { avaliarRetomadaCompensacaoQa } = await import(
      "./server/services/billingCompensacaoEventoTentativaQaService.js"
    );

    const antes =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
        include: {
          historicoTentativas: true,
        },
      });

    const resultado =
      await avaliarRetomadaCompensacaoQa(pagamentoId);

    const depois =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
        include: {
          historicoTentativas: true,
        },
      });

    assert.equal(resultado.motivo, motivoEsperado);

    assert.equal(
      resultado.chaveIdempotencia,
      `footera-evento-refund-${pagamentoId}`
    );

    assert.equal(resultado.podeEnviarEstorno, false);
    assert.equal(resultado.podeRepetirEstorno, false);
    assert.equal(resultado.podeConfirmarCompensacao, false);
    assert.equal(resultado.atualizarPagamento, false);

    assert.equal(
      resultado.compensacaoId,
      antes.id
    );

    assert.equal(
      antes.historicoTentativas.length,
      1
    );

    assert.equal(
      resultado.tentativaId,
      antes.historicoTentativas[0].id
    );

    assert.deepEqual(
      JSON.parse(JSON.stringify(depois)),
      JSON.parse(JSON.stringify(antes)),
      "QA_RETOMADA_ALTEROU_REGISTROS"
    );

    console.log(
      `✔ Processo independente confirmou: ${motivoEsperado}`
    );
    console.log(
      "[QA] Sem alteracao financeira ou chamada externa."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("FALHA_PROCESSO_FILHO:", erro);
  process.exitCode = 1;
});