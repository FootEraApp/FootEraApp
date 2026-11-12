
"use strict";

// Diagnóstico Prisma — SOMENTE LEITURA.
// Permitido apenas nos bancos locais footera e footera_billing_qa.

const { PrismaClient } = require("@prisma/client");

async function main() {
  const url = new URL(
    process.env.DATABASE_URL || "http://invalid"
  );

  const bancoPermitido = [
    "/footera",
    "/footera_billing_qa",
  ].includes(url.pathname);

  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    !bancoPermitido
  ) {
    throw new Error(
      "Este diagnóstico permite somente bancos locais " +
      "footera ou footera_billing_qa na porta 5433."
    );
  }

  const prisma = new PrismaClient();

  try {
    console.log("\n==================================");
    console.log("BANCO:", url.hostname + ":" + url.port + url.pathname);
    console.log("==================================");

    const tabelas = await prisma.$queryRaw`
      SELECT table_name AS nome
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          '_prisma_migrations',
          'Pagamento',
          'PagamentoBeneficio',
          'CupomReserva',
          'CreatorVenda',
          'MetodologiaAssinante'
        )
      ORDER BY table_name
    `;

    console.log(
      "\nTabelas encontradas:",
      tabelas.map((t) => t.nome)
    );

    const existeHistorico = tabelas.some(
      (t) => t.nome === "_prisma_migrations"
    );

    if (!existeHistorico) {
      console.log(
        "\nATENÇÃO: _prisma_migrations não existe."
      );
      console.log(
        "Não execute migrate deploy ou reset."
      );
      return;
    }

    const resumo = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE finished_at IS NOT NULL
            AND rolled_back_at IS NULL
        )::int AS concluidas,
        COUNT(*) FILTER (
          WHERE finished_at IS NULL
            AND rolled_back_at IS NULL
        )::int AS nao_concluidas,
        COUNT(*) FILTER (
          WHERE rolled_back_at IS NOT NULL
        )::int AS revertidas
      FROM "_prisma_migrations"
    `;

    console.log("\nRESUMO DAS MIGRAÇÕES:");
    console.log(resumo[0]);

    const ultimas = await prisma.$queryRaw`
      SELECT
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        LEFT(COALESCE(logs, ''), 180) AS trecho_logs
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 12
    `;

    console.log("\nÚLTIMAS 12 MIGRAÇÕES:");
    console.log(JSON.stringify(ultimas, null, 2));

    console.log("\nDiagnóstico concluído — nenhuma alteração realizada.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("Falha no diagnóstico:", erro);
  process.exitCode = 1;
});
