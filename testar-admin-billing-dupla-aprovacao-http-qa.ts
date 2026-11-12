import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

function validarAmbienteQa(): void {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    !["postgresql:", "postgres:"].includes(db.protocol) ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "false"
  ) {
    throw new Error("ETAPA4_AMBIENTE_QA_INSEGURO");
  }
}

async function main(): Promise<void> {
  validarAmbienteQa();

  const envOriginal = {
    jwt: process.env.JWT_SECRET,
    requester: process.env.BILLING_REFUND_REQUESTER_IDS,
    approver: process.env.BILLING_REFUND_APPROVER_IDS,
    executor: process.env.BILLING_REFUND_EXECUTOR_IDS,
    limite: process.env.BILLING_REFUND_MAX_CENTAVOS,
  };

  process.env.JWT_SECRET = randomBytes(48).toString("hex");

  const { prisma } = await import("./server/prisma.js");
  const { default: express } = await import("express");
  const { default: jwt } = await import("jsonwebtoken");
  const { default: rotas } =
    await import("./server/routes/adminBilling.js");
  const { canPermission } =
    await import("./server/services/permissions.js");
  const { resolveUserContext } =
    await import("./server/services/planResolver.js");
  const { prepararCompensacaoEventoVerificada } =
    await import(
      "./server/services/billingCompensacaoEventoVerificadaService.js"
    );
  const { configurarConsultorMercadoPagoQa } =
    await import(
      "./server/services/billingMercadoPagoGateway.js"
    );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const mpId = `${Date.now()}97531`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let concluido = false;
  let servidor: ReturnType<Express["listen"]> | null = null;
  let autorizacaoId: string | null = null;
  let aprovados = 0;

  function restaurarEnv(
    nome: string,
    valor: string | undefined
  ): void {
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }

  async function confirmar(
    nome: string,
    verificar: () => Promise<void>
  ): Promise<void> {
    await verificar();
    aprovados++;
    console.log(`✔ ${nome}`);
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    // Encontrar dois administradores com sessao valida.
    const admins = await prisma.administrador.findMany({
      select: { usuarioId: true },
      take: 100,
    });

    const elegiveis: string[] = [];

    for (const admin of admins) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: admin.usuarioId },
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

      if (!(await canPermission(admin.usuarioId, "VER_ADMIN"))) {
        continue;
      }

      try {
        await resolveUserContext(admin.usuarioId);
        elegiveis.push(admin.usuarioId);
      } catch {
        // Ignorar admin sem contexto ativo.
      }

      if (elegiveis.length === 2) {
        break;
      }
    }

    if (elegiveis.length !== 2) {
      throw new Error(
        "ETAPA4_QA_EXIGE_DOIS_ADMINS_ELEGIVEIS"
      );
    }

    const [adminA, adminB] = elegiveis;

    // Permissoes exclusivamente neste processo QA.
    // Nao altera cadastros de permissao no banco.
    process.env.BILLING_REFUND_REQUESTER_IDS = adminA;
    process.env.BILLING_REFUND_APPROVER_IDS =
      `${adminA},${adminB}`;
    process.env.BILLING_REFUND_EXECUTOR_IDS = "";
    process.env.BILLING_REFUND_MAX_CENTAVOS = "5000";

    async function token(usuarioId: string): Promise<string> {
      const usuario =
        await prisma.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { tokenVersion: true },
        });

      return jwt.sign(
        {
          id: usuarioId,
          tokenVersion: usuario.tokenVersion ?? 0,
        },
        process.env.JWT_SECRET!,
        {
          expiresIn: "5m",
          algorithm: "HS256",
        }
      );
    }

    const tokenA = await token(adminA);
    const tokenB = await token(adminB);

    // Reutiliza a fixture que ja passou no QA.
    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Dupla Autorizacao ${eventoId}`,
        descricao: "Fixture temporaria ETAPA 4",
        status: "ABERTO",
        dataEvento: new Date(
          Date.now() + 10 * 86400000
        ),
        inscricaoInicio: new Date(
          Date.now() - 86400000
        ),
        inscricaoFim: new Date(
          Date.now() + 9 * 86400000
        ),
        vagas: 1,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });
    eventoCriado = true;

    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId: atleta.usuarioId,
        plano: `EVENTO:${eventoId}`,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "25.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: mpId,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
      },
    });
    pagamentoCriado = true;

    await prisma.billingPendenciaEvento.create({
      data: {
        pagamentoId,
        eventoId,
        motivo: "BILLING_EVENT_CAPACITY_EXCEEDED",
        status: "PENDENTE_ANALISE",
        providerRef: mpId,
        valor: "25.00",
        moeda: "BRL",
      },
    });

    configurarConsultorMercadoPagoQa(async (id) => {
      assert.equal(id, mpId);

      return {
        id: mpId,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId,
        metadata: { pagamentoId },
        transaction_amount: 25,
        currency_id: "BRL",
      };
    });

    await prepararCompensacaoEventoVerificada(pagamentoId);

    await confirmar(
      "Compensacao preparada sem estorno",
      async () => {
        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(c.status, "PREPARADA");
        assert.equal(c.tentativas, 0);
        assert.equal(c.confirmadoEm, null);
      }
    );

    const app = express();
    app.use(express.json());
    app.use("/api/admin", rotas);

    servidor = app.listen(0, "127.0.0.1");

    const serverAtivo = servidor;

    await new Promise<void>((resolve, reject) => {
      serverAtivo.once("listening", resolve);
      serverAtivo.once("error", reject);
    });

    const porta =
      (serverAtivo.address() as AddressInfo).port;

    const base =
      `http://127.0.0.1:${porta}` +
      `/api/admin/billing/estornos/${pagamentoId}`;

    async function chamar(
      acao: string,
      jwtToken: string,
      metodo: "GET" | "POST",
      body?: Record<string, unknown>
    ) {
      const resposta = await fetch(
        `${base}/${acao}`,
        {
          method: metodo,
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            ...(metodo === "POST"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(metodo === "POST"
            ? { body: JSON.stringify(body ?? {}) }
            : {}),
        }
      );

      const json = await resposta.json();

      return {
        status: resposta.status,
        json,
      };
    }

    await confirmar(
      "Admin A solicita autorizacao HTTP",
      async () => {
        const r = await chamar(
          "solicitar",
          tokenA,
          "POST",
          {
            motivo:
              "QA - Validacao de dupla aprovacao administrativa.",
          }
        );

        assert.equal(r.status, 201, JSON.stringify(r.json));
        assert.equal(r.json.ok, true);
        assert.equal(r.json.status, "PENDENTE");
      }
    );

    await confirmar(
      "Autoaprovacao do Admin A bloqueada",
      async () => {
        const r = await chamar(
          "aprovar",
          tokenA,
          "POST"
        );

        assert.equal(r.status, 403, JSON.stringify(r.json));
        assert.equal(
          r.json.code,
          "BILLING_AUTORIZACAO_NAO_APROVAVEL"
        );
      }
    );

    await confirmar(
      "Admin B aprova por HTTP",
      async () => {
        const r = await chamar(
          "aprovar",
          tokenB,
          "POST"
        );

        assert.equal(r.status, 200, JSON.stringify(r.json));
        assert.equal(r.json.status, "APROVADA");
        assert.equal(r.json.estornoExecutado, false);
      }
    );

    await confirmar(
      "Autorizacao aprovada registrada no banco",
      async () => {
        const a =
          await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
            where: { pagamentoId },
          });

        autorizacaoId = a.id;

        assert.equal(a.status, "APROVADA");
        assert.equal(a.solicitanteId, adminA);
        assert.equal(a.aprovadorId, adminB);
        assert.ok(a.expiraEm);
        assert.equal(a.consumidoEm, null);
      }
    );

    await confirmar(
      "Admin B revoga autorizacao por HTTP",
      async () => {
        const r = await chamar(
          "revogar",
          tokenB,
          "POST"
        );

        assert.equal(r.status, 200, JSON.stringify(r.json));
        assert.equal(r.json.revogada, true);
        assert.equal(r.json.estornoExecutado, false);
      }
    );

    await confirmar(
      "Revogacao e auditorias persistidas",
      async () => {
        const a =
          await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(a.status, "REVOGADA");
        assert.equal(a.consumidoEm, null);
        assert.ok(a.revogadoEm);

        const logs = await prisma.logAuditoria.findMany({
          where: {
            entidade: "BillingAutorizacaoEstorno",
            entidadeId: a.id,
          },
          select: { acao: true },
        });

        const acoes = new Set(
          logs.map((log) => log.acao)
        );

        for (const acao of [
          "BILLING_ESTORNO_SOLICITADO",
          "BILLING_ESTORNO_APROVADO",
          "BILLING_ESTORNO_REVOGADO",
        ]) {
          assert.ok(acoes.has(acao), acao);
        }
      }
    );

    await confirmar(
      "Pagamento permanece intocado",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        const compensacao =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        const inscricoes =
          await prisma.inscricaoEvento.count({
            where: { eventoId },
          });

        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.reembolsadoEm, null);
        assert.equal(compensacao.status, "PREPARADA");
        assert.equal(compensacao.tentativas, 0);
        assert.equal(beneficios, 0);
        assert.equal(inscricoes, 0);
      }
    );

    concluido = true;

    console.log(`\nRESULTADO: ${aprovados}/8`);
    console.log("ETAPA4_DUPLA_APROVACAO_HTTP_QA_APROVADA");
  } finally {
    // Desativar o mock independentemente do resultado.
    configurarConsultorMercadoPagoQa(null);

    if (servidor) {
      await new Promise<void>((resolve) => {
        servidor!.close(() => resolve());
      });
    }

    try {
      if (concluido && pagamentoCriado) {
        // Limpeza somente dos IDs criados neste teste.
        // Nao apagar dados de outros pagamentos.
        await prisma.$transaction(async (tx) => {
          const a =
            await tx.billingAutorizacaoEstorno.findUnique({
              where: { pagamentoId },
            });

          if (
            !a ||
            a.id !== autorizacaoId ||
            a.status !== "REVOGADA" ||
            a.consumidoEm !== null
          ) {
            throw new Error(
              "QA_LIMPEZA_AUTORIZACAO_INESPERADA"
            );
          }

          await tx.logAuditoria.deleteMany({
            where: {
              entidade: "BillingAutorizacaoEstorno",
              entidadeId: a.id,
            },
          });

          await tx.billingAutorizacaoEstorno.delete({
            where: { pagamentoId },
          });

          await tx.billingCompensacaoEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.billingPendenciaEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });

        pagamentoCriado = false;
      }

      if (concluido && eventoCriado) {
        await prisma.evento.delete({
          where: { id: eventoId },
        });

        eventoCriado = false;
      }

      if (!concluido) {
        console.warn(
          "QA interrompido. Fixtures preservadas:",
          { eventoId, pagamentoId }
        );
      }
    } finally {
      restaurarEnv("JWT_SECRET", envOriginal.jwt);
      restaurarEnv(
        "BILLING_REFUND_REQUESTER_IDS",
        envOriginal.requester
      );
      restaurarEnv(
        "BILLING_REFUND_APPROVER_IDS",
        envOriginal.approver
      );
      restaurarEnv(
        "BILLING_REFUND_EXECUTOR_IDS",
        envOriginal.executor
      );
      restaurarEnv(
        "BILLING_REFUND_MAX_CENTAVOS",
        envOriginal.limite
      );

      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(
    "ETAPA4_DUPLA_APROVACAO_HTTP_QA_FALHOU:",
    erro
  );

  process.exitCode = 1;
});