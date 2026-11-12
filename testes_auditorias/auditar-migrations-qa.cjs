const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    const banco = await prisma.$queryRawUnsafe(
      "SELECT current_database() AS nome"
    );

    console.log("BANCO:", banco);

    const tabelas = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          '_prisma_migrations',
          'Pagamento',
          'BillingCompensacaoEvento',
          'BillingCompensacaoTentativa',
          'BillingCompensacaoConsultaRecuperacao'
        )
      ORDER BY table_name
    `);

    console.log("TABELAS:", tabelas);

    const existeHistorico = tabelas.some(
      x => x.table_name === "_prisma_migrations"
    );

    if (existeHistorico) {
      const historico = await prisma.$queryRawUnsafe(`
        SELECT migration_name,
               finished_at,
               rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at DESC
        LIMIT 15
      `);

      console.log("HISTORICO:", historico);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
