
import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

async function main() {
  if (
    process.env.BILLING_TEST_MODE !== "true" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Este script só pode executar no modo de teste."
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  const usuarioId = process.env.BILLING_TEST_USER_ID;
  const assinaturaId =
    process.env.BILLING_TEST_ASSINATURA_ID;

  if (!databaseUrl || !usuarioId || !assinaturaId) {
    throw new Error(
      "Configure DATABASE_URL e os IDs de teste."
    );
  }

  const url = new URL(databaseUrl);

  if (
    !["localhost", "127.0.0.1"].includes(
      url.hostname
    ) ||
    url.port !== "5433"
  ) {
    throw new Error(
      "Operação bloqueada: o banco não é o PostgreSQL local esperado."
    );
  }

  const { prisma } = await import("../prisma.js");

  try {
    const assinatura = await prisma.assinatura.findFirst({
      where: {
        id: assinaturaId,
        usuarioId,
        status: "BLOQUEADA",
        ativo: false,
      },
    });

    if (!assinatura) {
      throw new Error(
        "Assinatura bloqueada de teste não encontrada."
      );
    }

    const inicio = new Date();
    const vencimento = new Date(inicio);

    vencimento.setUTCMonth(
      vencimento.getUTCMonth() + 1
    );

    const resultado = await prisma.assinatura.update({
      where: {
        id: assinatura.id,
      },
      data: {
        status: "ATIVA",
        ativo: true,
        startsAt: inicio,
        renovaEm: vencimento,
        trialStartsAt: null,
        trialEndsAt: null,
        bloqueadoEm: null,
        canceledAt: null,
        lembreteEnviado: false,
      },
      select: {
        id: true,
        status: true,
        ativo: true,
        startsAt: true,
        renovaEm: true,
        trialEndsAt: true,
        bloqueadoEm: true,
        lembreteEnviado: true,
      },
    });

    console.log(
      "[billing-test] Renovação simulada:",
      resultado
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "[billing-test] Erro ao simular renovação:",
    error
  );

  process.exitCode = 1;
});