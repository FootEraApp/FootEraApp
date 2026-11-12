const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    const [db] = await prisma.$queryRaw`
      SELECT current_database() AS nome
    `;

    if (db?.nome !== "footera_billing_qa") {
      throw new Error("BANCO_INCORRETO");
    }

    const indices = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ResponsavelAtleta'
        AND indexname = 'ResponsavelAtleta_um_principal_ativo'
    `;

    console.log(indices);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
