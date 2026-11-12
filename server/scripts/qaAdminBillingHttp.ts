
/**
 * server/scripts/qaAdminBillingHttp.ts
 *
 * Servidor HTTP isolado da ETAPA 4.
 *
 * Somente rotas adminBilling.
 * Nao inicializa server/index.ts.
 * Nao inicializa schedulers.
 * Nao executa estornos reais.
 */

const PORTA_QA = 3107;

function verificarAmbiente(): void {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    !["postgresql:", "postgres:"].includes(
      url.protocol
    ) ||
    !["127.0.0.1", "localhost"].includes(
      url.hostname
    ) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !==
      "false" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !==
      "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "false"
  ) {
    throw new Error(
      "BILLING_HTTP_QA_AMBIENTE_NAO_AUTORIZADO"
    );
  }
}

async function main(): Promise<void> {
  verificarAmbiente();

  // Importacoes somente depois das verificacoes.
  const { default: express } = await import("express");

  const { default: adminBillingRoutes } =
    await import("../routes/adminBilling.js");

  const { prisma } =
    await import("../prisma.js");

  // Revalidar depois dos imports caso alguma
  // dependencia carregue arquivos de ambiente.
  verificarAmbiente();

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  if (banco[0]?.nome !== "footera_billing_qa") {
    await prisma.$disconnect();

    throw new Error(
      "BILLING_HTTP_QA_BANCO_DIVERGENTE"
    );
  }

  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/qa/health", (_req, res) => {
    return res.status(200).json({
      ok: true,
      modo: "BILLING_ADMIN_HTTP_QA",
      somenteLocal: true,
      estornoRealHabilitado: false,
    });
  });

  // Reutiliza exatamente as rotas e middlewares
  // administrativos reais, sem server/index.ts.
  app.use("/api/admin", adminBillingRoutes);

  const servidor = app.listen(
    PORTA_QA,
    "127.0.0.1",
    () => {
      console.log(
        `[QA] Admin Billing HTTP em http://127.0.0.1:${PORTA_QA}`
      );
      console.log(
        "[QA] Banco: footera_billing_qa"
      );
      console.log(
        "[QA] Schedulers gerais nao inicializados."
      );
      console.log(
        "[QA] Estornos reais bloqueados."
      );
    }
  );

  let encerrando = false;

  async function encerrar(): Promise<void> {
    if (encerrando) return;
    encerrando = true;

    servidor.close(async () => {
      await prisma.$disconnect();
      console.log("[QA] Servidor encerrado.");
    });
  }

  process.once("SIGINT", () => {
    void encerrar();
  });

  process.once("SIGTERM", () => {
    void encerrar();
  });
}

main().catch((erro) => {
  console.error(
    "BILLING_HTTP_QA_FALHOU:",
    erro
  );

  process.exitCode = 1;
});