import { prisma } from "./server/prisma.js";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("BANCO_QA_INCORRETO");
  }

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  if (banco[0]?.nome !== "footera_billing_qa") {
    throw new Error("BANCO_REAL_DIVERGENTE");
  }

  const tabelas = await prisma.$queryRaw<
    Array<{ table_name: string }>
  >`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        '_prisma_migrations',
        'Pagamento',
        'BillingCompensacaoTentativa'
      )
    ORDER BY table_name
  `;

  const colunas = await prisma.$queryRaw<
    Array<{ column_name: string; data_type: string }>
  >`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BillingCompensacaoTentativa'
      AND column_name IN (
        'requisicaoEnviadaEm',
        'postAutorizacaoConsumidaEm'
      )
    ORDER BY column_name
  `;

  console.log("BANCO:", banco[0]?.nome);
  console.log("TABELAS:", tabelas);
  console.log("COLUNAS:", colunas);

  if (tabelas.some(
    t => t.table_name === "_prisma_migrations"
  )) {
    const historico = await prisma.$queryRaw<
      Array<{
        total: bigint;
        aplicadas: bigint;
      }>
    >`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE finished_at IS NOT NULL
            AND rolled_back_at IS NULL
        ) AS aplicadas
      FROM "_prisma_migrations"
    `;

    console.log("MIGRACOES_REGISTRADAS:", {
      total: Number(historico[0]?.total ?? 0),
      aplicadas: Number(historico[0]?.aplicadas ?? 0),
    });
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
