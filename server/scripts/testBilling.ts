import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

const BANCO_QA_SCHEDULER = "footera_billing_scheduler_qa_20261103";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const usuarioId = process.env.BILLING_TEST_USER_ID?.trim();
  const assinaturaId = process.env.BILLING_TEST_ASSINATURA_ID?.trim();

  if (process.env.NODE_ENV !== "test") {
    throw new Error("BILLING_TEST_NODE_ENV_DEVE_SER_TEST");
  }

  if (process.env.BILLING_TEST_MODE !== "true") {
    throw new Error("Ative BILLING_TEST_MODE=true para este teste.");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL_INVALIDA");
  }

  const bancoAtual = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (
    url.protocol !== "postgresql:" &&
    url.protocol !== "postgres:"
  ) {
    throw new Error("BILLING_TEST_PROTOCOLO_INVALIDO");
  }

  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    bancoAtual !== BANCO_QA_SCHEDULER
  ) {
    throw new Error(
      `BILLING_TEST_DB_INCORRETO: utilize somente o banco local ${BANCO_QA_SCHEDULER} na porta 5433.`
    );
  }

  if (
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false"
  ) {
    throw new Error("BILLING_TEST_SCHEDULERS_DEVEM_ESTAR_DESATIVADOS");
  }

  if (process.env.ENABLE_ACCOUNT_PURGE === "true") {
    throw new Error("BILLING_TEST_ACCOUNT_PURGE_DEVE_ESTAR_DESATIVADO");
  }

  if (process.env.MP_ACCESS_TOKEN?.trim()) {
    throw new Error("BILLING_TEST_MP_ACCESS_TOKEN_DEVE_ESTAR_VAZIO");
  }

  if (process.env.SMTP_HOST?.trim()) {
    throw new Error(
      "Teste bloqueado: SMTP_HOST configurado. Remova a variavel do ambiente de teste."
    );
  }

  if (!usuarioId) {
    throw new Error("Defina BILLING_TEST_USER_ID.");
  }

  if (!assinaturaId) {
    throw new Error("Defina BILLING_TEST_ASSINATURA_ID.");
  }

  const { prisma } = await import("../prisma.js");

  try {
    const bancoReal = await prisma.$queryRaw<Array<{ banco: string }>>`
      SELECT current_database() AS banco
    `;

    if (bancoReal.length !== 1 || bancoReal[0]?.banco !== BANCO_QA_SCHEDULER) {
      throw new Error("BILLING_TEST_CONEXAO_REAL_INCORRETA");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        deletedAt: true,
      },
    });

    if (!usuario || usuario.deletedAt) {
      throw new Error("Usuario de teste inexistente ou excluido.");
    }

    const assinaturas = await prisma.assinatura.findMany({
      where: {
        id: assinaturaId,
        usuarioId,
      },
      select: {
        id: true,
        plano: true,
        status: true,
        ativo: true,
        renovaEm: true,
      },
    });

    if (assinaturas.length !== 1) {
      throw new Error(
        "O usuario de teste deve possuir exatamente a assinatura especificada."
      );
    }

    console.log("[billing-test] Banco isolado:", bancoReal[0].banco);
    console.log("[billing-test] Usuario:", usuario.nome);
    console.log("[billing-test] Assinatura antes:", assinaturas);

    const { processExpiringSubscriptions } = await import(
      "../controllers/billingController.js"
    );

    const resultado = await processExpiringSubscriptions({
      usuarioId,
      assinaturaId,
    });

    console.log("[billing-test] Resultado:", resultado);

    if (!resultado || resultado.ok !== true) {
      throw new Error(
        "BILLING_QA_PROCESSAMENTO_NAO_APROVADO"
      );
    }

    const assinaturasDepois = await prisma.assinatura.findMany({
      where: {
        id: assinaturaId,
        usuarioId,
      },
      select: {
        id: true,
        status: true,
        ativo: true,
        lembreteEnviado: true,
        bloqueadoEm: true,
      },
    });

    const comunicacoes = await prisma.billingComunicacao.findMany({
      where: {
        assinaturaId,
      },
      orderBy: { criadoEm: "asc" },
    });

    const comunicacoesInvalidas = comunicacoes.filter(
      (item) =>
        item.tentativas < 0 ||
        item.tentativas > 5 ||
        (item.status === "ENVIADO" && !item.enviadoEm)
    );

    if (comunicacoesInvalidas.length > 0) {
      throw new Error(
        "BILLING_QA_COMUNICACOES_INCONSISTENTES"
      );
    }

    const notificacoes = await prisma.notificacao.findMany({
      where: {
        usuarioId,
        tipo: {
          in: ["BILLING_WARNING", "BILLING_BLOCKED"],
        },
      },
      select: {
        id: true,
        titulo: true,
        mensagem: true,
        lida: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    console.log("[billing-test] Assinaturas depois:", assinaturasDepois);

    console.table(
      comunicacoes.map((item) => ({
        evento: item.evento,
        canal: item.canal,
        status: item.status,
        tentativas: item.tentativas,
        erro: item.ultimoErro,
      }))
    );

    console.log("[billing-test] Notificacoes:", notificacoes);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[billing-test] Falha:", error);
  process.exitCode = 1;
});