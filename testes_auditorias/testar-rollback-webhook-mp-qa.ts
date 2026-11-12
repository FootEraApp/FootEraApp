
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  // Segurança: validar ambiente antes de importar
  // os componentes que acessam o banco.
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_ABORTADO: ambiente inseguro");
  }

  const { prisma } = await import("./server/prisma.js");
  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );
  const {
    mercadoPagoWebhook,
  } = await import(
    "./server/controllers/billingController.js"
  );

  const pagamentoId = randomUUID();
  const eventoInexistenteId = randomUUID();
  const mpId = (
    BigInt(Date.now()) * 100000n + 87421n
  ).toString();

  const planoValido = "ATLETA_PRO";
  const contextoKey = "personal:Atleta";

  let pagamentoCriado = false;
  let assinaturaCriadaId: string | null = null;
  let falhas = 0;
  let aprovados = 0;
  let concluiu = false;

  async function testar(
    descricao: string,
    fn: () => Promise<void>
  ) {
    try {
      await fn();
      aprovados++;
      console.log("✔", descricao);
    } catch (erro) {
      falhas++;
      console.error("✖", descricao, erro);
    }
  }

  async function webhook() {
    let status = 0;
    let corpo: any = null;

    const req = {
      query: {
        type: "payment",
        "data.id": mpId,
      },
      body: {
        type: "payment",
        data: {
          id: mpId,
        },
      },
    };

    const res = {
      status(codigo: number) {
        status = codigo;
        return this;
      },
      json(valor: unknown) {
        corpo = valor;
        return this;
      },
    };

    await mercadoPagoWebhook(req as any, res as any);
    return { status, corpo };
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    // Evitar renovar assinatura existente.
    const usuarios = await prisma.usuario.findMany({
      select: { id: true },
      take: 200,
    });

    let usuarioId: string | null = null;

    for (const usuario of usuarios) {
      const existente = await prisma.assinatura.findUnique({
        where: {
          usuarioId_plano_contextoKey: {
            usuarioId: usuario.id,
            plano: planoValido,
            contextoKey,
          },
        },
        select: { id: true },
      });

      if (!existente) {
        usuarioId = usuario.id;
        break;
      }
    }

    if (!usuarioId) {
      throw new Error("QA_SEM_USUARIO_DISPONIVEL");
    }

    console.log("[QA] Usuario:", usuarioId);
    console.log("[QA] Pagamento:", pagamentoId);

    // Primeira tentativa: produto não existe.
    // Isso provoca erro DENTRO da transação.
    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId,
        plano: `EVENTO:${eventoInexistenteId}`,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "25.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: `PREF-QA-${pagamentoId}`,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
        contextoPerfilId: null,
      },
    });

    pagamentoCriado = true;

    configurarConsultorMercadoPagoQa(
      async (id) => {
        assert.equal(id, mpId);

        return {
          id: mpId,
          status: "approved",
          status_detail: "accredited",
          transaction_amount: 25,
          currency_id: "BRL",
          external_reference: pagamentoId,
          metadata: {
            pagamentoId,
          },
        };
      }
    );

    await testar(
      "Falha intermediaria nao retorna sucesso",
      async () => {
        const resposta = await webhook();
        assert.notEqual(resposta.status, 200);
      }
    );

    await testar(
      "Rollback preserva pagamento PENDENTE",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.pagoEm, null);

        // providerRef pode ter sido associado antes
        // da transação, mas não há aprovação.
        assert.equal(pagamento.providerRef, mpId);
      }
    );

    await testar(
      "Rollback nao cria beneficio",
      async () => {
        const quantidade =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(quantidade, 0);
      }
    );

    // Este é um pagamento criado exclusivamente
    // pelo teste; podemos corrigir seu plano.
    const antesDaCorrecao =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId },
      });

    assert.equal(antesDaCorrecao.status, "PENDENTE");

    await prisma.pagamento.update({
      where: { id: pagamentoId },
      data: { plano: planoValido },
    });

    await testar(
      "Nova tentativa aprova o pagamento",
      async () => {
        const resposta = await webhook();

        assert.equal(
          resposta.status,
          200,
          JSON.stringify(resposta.corpo)
        );

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "APROVADO");
      }
    );

    await testar(
      "Reprocessamento cria assinatura",
      async () => {
        const assinatura =
          await prisma.assinatura.findUnique({
            where: {
              usuarioId_plano_contextoKey: {
                usuarioId: usuarioId!,
                plano: planoValido,
                contextoKey,
              },
            },
          });

        assert.ok(assinatura);
        assert.equal(assinatura.ativo, true);

        assinaturaCriadaId = assinatura.id;
      }
    );

    await testar(
      "Reprocessamento cria um beneficio",
      async () => {
        const beneficios =
          await prisma.pagamentoBeneficio.findMany({
            where: { pagamentoId },
          });

        assert.equal(beneficios.length, 1);
        assert.equal(beneficios[0].tipo, "ASSINATURA");
        assert.equal(
          beneficios[0].recursoId,
          assinaturaCriadaId
        );
      }
    );

    await testar(
      "Repeticao nao duplica beneficios",
      async () => {
        const resposta = await webhook();

        assert.equal(resposta.status, 200);

        const quantidade =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(quantidade, 1);
      }
    );

    concluiu = falhas === 0;
  } finally {
    configurarConsultorMercadoPagoQa(null);

    // Limpeza só se todos os testes passarem.
    // Em caso de falha, preservar para auditoria.
    if (
      concluiu &&
      pagamentoCriado &&
      assinaturaCriadaId
    ) {
      await prisma.$transaction(async (tx) => {
        const beneficio =
          await tx.pagamentoBeneficio.findMany({
            where: { pagamentoId },
          });

        if (
          beneficio.length !== 1 ||
          beneficio[0].recursoId !== assinaturaCriadaId
        ) {
          throw new Error("QA_CLEANUP_ABORTADO");
        }

        await tx.pagamentoBeneficio.deleteMany({
          where: { pagamentoId },
        });

        await tx.assinatura.delete({
          where: { id: assinaturaCriadaId },
        });

        await tx.pagamento.delete({
          where: { id: pagamentoId },
        });
      });

      console.log("[QA] Registros do teste removidos.");
    } else if (pagamentoCriado) {
      console.warn(
        "[QA] Registros preservados:",
        pagamentoId
      );
    }

    await prisma.$disconnect();
  }

  console.log(
    `\nRESULTADO: ${aprovados}/${aprovados + falhas}`
  );

  if (falhas > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});