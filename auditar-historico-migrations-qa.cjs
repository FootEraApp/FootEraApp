const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    const banco = await prisma.$queryRaw`
      SELECT current_database() AS nome
    `;

    if (banco[0]?.nome !== "footera_billing_qa") {
      throw new Error("BANCO_NAO_AUTORIZADO");
    }

    const resumo = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE finished_at IS NOT NULL
            AND rolled_back_at IS NULL
        )::int AS aplicadas,
        COUNT(*) FILTER (
          WHERE finished_at IS NULL
            AND rolled_back_at IS NULL
        )::int AS incompletas
      FROM "_prisma_migrations"
    `;

    const historico = await prisma.$queryRaw`
      SELECT
        migration_name,
        checksum,
        started_at,
        finished_at,
        rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at
    `;

    console.log(
      "RESUMO:",
      JSON.stringify(resumo, null, 2)
    );

    console.log(
      "HISTORICO:",
      JSON.stringify(historico, null, 2)
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
