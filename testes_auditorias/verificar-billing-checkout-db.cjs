
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");

  if (
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa" ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.NODE_ENV !== "test"
  ) {
    throw new Error("QA_ABORTADO: ambiente financeiro inseguro");
  }

  const banco = await prisma.$queryRaw`
    SELECT current_database() AS nome
  `;

  console.log("Banco conectado:", banco);

  const tabelas = await prisma.$queryRaw`
    SELECT to_regclass('public."BillingCheckoutOperacao"')::text AS tabela
  `;

  console.log("Tabela encontrada:", tabelas);

  const colunas = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BillingCheckoutOperacao'
    ORDER BY ordinal_position
  `;

  console.table(colunas);

  const indices = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'BillingCheckoutOperacao'
    ORDER BY indexname
  `;

  console.table(indices);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });