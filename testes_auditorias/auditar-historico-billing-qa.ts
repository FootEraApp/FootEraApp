import { prisma } from "./server/prisma.js";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    process.env.MP_ACCESS_TOKEN ||
    db.hostname !== "127.0.0.1" ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("AMBIENTE_QA_INVALIDO");
  }

  const historico = await prisma.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>
  >`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;

  console.table(historico);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
