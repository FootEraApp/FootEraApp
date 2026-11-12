
/*
 * server/scripts/adminEstornoEvento.ts
 *
 * Prévia administrativa QA.
 * NÃO executa estorno nem consulta o Mercado Pago.
 *
 * Uso:
 * npx tsx server/scripts/adminEstornoEvento.ts status UUID
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  const [, , comando, pagamentoId] = process.argv;

  if (comando !== "status" || !UUID.test(pagamentoId ?? "")) {
    throw new Error(
      "USO: npx tsx server/scripts/adminEstornoEvento.ts status PAGAMENTO_UUID"
    );
  }

  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED === "true"
  ) {
    throw new Error("BILLING_COMANDO_AMBIENTE_NAO_AUTORIZADO");
  }

  // Importar o Prisma somente após verificar o ambiente.
  const { prisma } = await import("../prisma.js");

  try {
    const pagamento = await prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      select: {
        id: true,
        plano: true,
        status: true,
        valor: true,
        moeda: true,
        provider: true,
        providerRef: true,
        reembolsadoEm: true,
      },
    });

    if (!pagamento) {
      throw new Error("BILLING_PAGAMENTO_NAO_ENCONTRADO");
    }

    const [compensacao, autorizacao] =
      await Promise.all([
        prisma.billingCompensacaoEvento.findUnique({
          where: { pagamentoId },
          include: {
            pendencia: {
              select: {
                status: true,
                motivo: true,
                eventoId: true,
                resolvidoEm: true,
              },
            },
            historicoTentativas: {
              select: {
                numero: true,
                ambiente: true,
                status: true,
                requisicaoEnviadaEm: true,
                postAutorizacaoConsumidaEm: true,
                operacaoExternaExecutada: true,
                estornoProviderRef: true,
              },
              orderBy: { numero: "desc" },
              take: 5,
            },
          },
        }),
        prisma.billingAutorizacaoEstorno.findUnique({
          where: { pagamentoId },
        }),
      ]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          somenteConsulta: true,
          pagamento: {
            ...pagamento,
            valor: pagamento.valor.toString(),
          },
          compensacao: compensacao
            ? {
                id: compensacao.id,
                status: compensacao.status,
                valor: compensacao.valor.toString(),
                moeda: compensacao.moeda,
                tentativas: compensacao.tentativas,
                confirmadoEm: compensacao.confirmadoEm,
                pendencia: compensacao.pendencia,
                historicoTentativas:
                  compensacao.historicoTentativas,
              }
            : null,
          autorizacao: autorizacao
            ? {
                id: autorizacao.id,
                status: autorizacao.status,
                valor: autorizacao.valor.toString(),
                moeda: autorizacao.moeda,
                solicitanteId: autorizacao.solicitanteId,
                aprovadorId: autorizacao.aprovadorId,
                expiraEm: autorizacao.expiraEm,
                consumidoEm: autorizacao.consumidoEm,
              }
            : null,
          execucaoLiberada: false,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(
    "BILLING_COMANDO_INTERNO_FALHOU:",
    erro instanceof Error ? erro.message : erro
  );
  process.exitCode = 1;
});