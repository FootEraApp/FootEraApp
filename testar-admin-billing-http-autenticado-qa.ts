
/**
 * testar-admin-billing-http-autenticado-qa.ts
 *
 * ETAPA 4 — Teste HTTP da autenticacao real.
 *
 * - Somente banco QA local.
 * - Sem Mercado Pago.
 * - Sem executar estornos.
 * - Sem criar usuarios ou pagamentos.
 * - Servidor temporario em porta aleatoria.
 */

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

function validarAmbiente(): void {
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
    process.env.ENABLE_EVENT_REFUNDS_REAL !==
      "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !==
      "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "false" ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false"
  ) {
    throw new Error(
      "BILLING_HTTP_AUTH_QA_AMBIENTE_INSEGURO"
    );
  }
}

async function main(): Promise<void> {
  validarAmbiente();

  // Segredo exclusivo deste processo.
  // Nunca imprimir ou salvar em arquivo.
  process.env.JWT_SECRET =
    randomBytes(48).toString("hex");

  const { default: express } =
    await import("express");

  const { default: jwt } =
    await import("jsonwebtoken");

  const { prisma } =
    await import("./server/prisma.js");

  const { default: adminBillingRoutes } =
    await import("./server/routes/adminBilling.js");

  const { canPermission } =
    await import("./server/services/permissions.js");

  const { resolveUserContext } =
    await import("./server/services/planResolver.js");

  validarAmbiente();

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  assert.equal(
    banco[0]?.nome,
    "footera_billing_qa"
  );

  // Encontrar um administrador real do QA
  // que tenha acesso ao painel e contexto valido.
  const administradores =
    await prisma.administrador.findMany({
      select: {
        usuarioId: true,
      },
      take: 100,
    });

  let administradorId: string | null = null;

  for (const item of administradores) {
    const usuario =
      await prisma.usuario.findUnique({
        where: { id: item.usuarioId },
        select: {
          verified: true,
          deletedAt: true,
          blockedAt: true,
        },
      });

    if (
      !usuario?.verified ||
      usuario.deletedAt ||
      usuario.blockedAt
    ) {
      continue;
    }

    if (
      !(await canPermission(
        item.usuarioId,
        "VER_ADMIN"
      ))
    ) {
      continue;
    }

    try {
      await resolveUserContext(item.usuarioId);
      administradorId = item.usuarioId;
      break;
    } catch {
      // Ignorar identidades sem contexto ativo.
    }
  }

  if (!administradorId) {
    throw new Error(
      "QA_NAO_ENCONTROU_ADMIN_ELEGIVEL"
    );
  }

  // Encontrar uma identidade comum.
  const usuarios =
    await prisma.usuario.findMany({
      where: {
        verified: true,
        deletedAt: null,
        blockedAt: null,
      },
      select: {
        id: true,
        tokenVersion: true,
      },
      take: 500,
    });

  const idsAdministradores =
    new Set(
      administradores.map(
        (item) => item.usuarioId
      )
    );

  let usuarioComumId: string | null = null;

  for (const usuario of usuarios) {
    if (idsAdministradores.has(usuario.id)) {
      continue;
    }

    try {
      await resolveUserContext(usuario.id);
      usuarioComumId = usuario.id;
      break;
    } catch {
      // Ignorar usuarios sem contexto ativo.
    }
  }

  if (!usuarioComumId) {
    throw new Error(
      "QA_NAO_ENCONTROU_USUARIO_COMUM_ELEGIVEL"
    );
  }

  async function gerarToken(
    usuarioId: string
  ): Promise<string> {
    const usuario =
      await prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: {
          tokenVersion: true,
        },
      });

    return jwt.sign(
      {
        id: usuarioId,
        tokenVersion:
          usuario.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "5m",
        algorithm: "HS256",
      }
    );
  }

  const tokenAdmin =
    await gerarToken(administradorId);

  const tokenComum =
    await gerarToken(usuarioComumId);

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminBillingRoutes);

  const servidor = app.listen(
    0,
    "127.0.0.1"
  );

  await new Promise<void>((resolve, reject) => {
    servidor.once("listening", resolve);
    servidor.once("error", reject);
  });

  const porta =
    (servidor.address() as AddressInfo).port;

  const pagamentoId = randomUUID();

  const caminho =
    `/api/admin/billing/estornos/` +
    `${pagamentoId}/previa`;

  const base =
    `http://127.0.0.1:${porta}`;

  const executorOriginal =
    process.env.BILLING_REFUND_EXECUTOR_IDS;

  let aprovados = 0;

    async function verificar(
    descricao: string,
    token: string | null,
    statusEsperado: number,
    codigoEsperado?: string,
    rota = caminho,
    metodo: "GET" | "POST" = "GET"
    ): Promise<void> {
    const headers: Record<string, string> = {};

    if (token) {
      headers.authorization =
        `Bearer ${token}`;
    }

    const resposta = await fetch(
    `${base}${rota}`,
    {
        method: metodo,
        headers:
        metodo === "POST"
            ? {
                ...headers,
                "content-type": "application/json",
            }
            : headers,
        ...(metodo === "POST"
        ? { body: JSON.stringify({}) }
        : {}),
    }
    );

    const resultado = await resposta.json() as {
      code?: string;
      message?: string;
    };

    assert.equal(
      resposta.status,
      statusEsperado,
      `${descricao}: ${JSON.stringify(resultado)}`
    );

    if (codigoEsperado) {
      assert.equal(
        resultado.code,
        codigoEsperado,
        descricao
      );
    }

    aprovados++;

    console.log(
      `✔ ${descricao}: HTTP ${resposta.status}`
    );
  }

  try {
    // 1. Sem JWT.
    await verificar(
      "Sem token",
      null,
      401
    );

    // 2. Token incorreto.
    await verificar(
      "Token invalido",
      "jwt-invalido",
      401
    );

    // 3. Usuario comum autenticado.
    await verificar(
      "Usuario comum nao acessa Admin",
      tokenComum,
      403,
      "ADMIN_ACCESS_REVOKED"
    );

    // 4. Admin sem permissao de executor.
    process.env.BILLING_REFUND_EXECUTOR_IDS = "";

    await verificar(
      "Admin sem permissao financeira",
      tokenAdmin,
      403,
      "BILLING_OPERADOR_FINANCEIRO_NAO_AUTORIZADO"
    );

    // 5. Admin com permissao financeira.
    // Utiliza pagamento inexistente.
    // Deve passar pela autorizacao e falhar
    // apenas pela ausencia do pagamento.
    process.env.BILLING_REFUND_EXECUTOR_IDS =
      administradorId;

    await verificar(
      "Admin autorizado chega a consulta financeira",
      tokenAdmin,
      403,
      "BILLING_OPERACIONAL_PAGAMENTO_AUSENTE"
    );

    const rotasProtegidas: Array<{
    sufixo: string;
    metodo: "GET" | "POST";
    }> = [
    { sufixo: "status", metodo: "GET" },
    { sufixo: "autorizacao", metodo: "GET" },
    { sufixo: "solicitar", metodo: "POST" },
    { sufixo: "aprovar", metodo: "POST" },
    { sufixo: "revogar", metodo: "POST" },
    { sufixo: "executar", metodo: "POST" },
    { sufixo: "conciliar", metodo: "POST" },
    ];

    for (const { sufixo, metodo } of rotasProtegidas) {
    const rota =
        `/api/admin/billing/estornos/` +
        `${pagamentoId}/${sufixo}`;

    await verificar(
        `${metodo} /${sufixo}: sem token`,
        null,
        401,
        undefined,
        rota,
        metodo
    );

    await verificar(
        `${metodo} /${sufixo}: usuario comum`,
        tokenComum,
        403,
        "ADMIN_ACCESS_REVOKED",
        rota,
        metodo
    );
    }

    // 20. Executor autorizado, mas envio real desligado.
    process.env.BILLING_REFUND_EXECUTOR_IDS =
    administradorId;

    await verificar(
    "Executor autorizado: estorno real bloqueado",
    tokenAdmin,
    503,
    "BILLING_EXECUCAO_OPERACIONAL_DESABILITADA",
    `/api/admin/billing/estornos/${pagamentoId}/executar`,
    "POST"
    );

    // 21. Executor autorizado, mas conciliacao real
    // indisponivel no ambiente QA.
    await verificar(
    "Executor autorizado: conciliacao real bloqueada",
    tokenAdmin,
    503,
    "BILLING_CONCILIACAO_OPERACIONAL_INDISPONIVEL",
    `/api/admin/billing/estornos/${pagamentoId}/conciliar`,
    "POST"
    );

    assert.equal(aprovados, 21);

    console.log(
    `\nRESULTADO: ${aprovados}/21`
    );

    console.log(
      "ETAPA4_HTTP_AUTENTICADO_QA_APROVADO"
    );
  } finally {
    if (executorOriginal === undefined) {
      delete process.env.BILLING_REFUND_EXECUTOR_IDS;
    } else {
      process.env.BILLING_REFUND_EXECUTOR_IDS =
        executorOriginal;
    }

    await new Promise<void>((resolve) => {
      servidor.close(() => resolve());
    });

    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(
    "ETAPA4_HTTP_AUTENTICADO_QA_FALHOU:",
    erro
  );

  process.exitCode = 1;
});