
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";

async function main() {
  // Proteção antes de importar módulos que usam Prisma.
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
    throw new Error(
      "QA_ABORTADO: somente banco footera_billing_qa local"
    );
  }

  const { prisma } = await import("./server/prisma.js");

  const pagamentoId = randomUUID();
  const mpId = (
    BigInt(Date.now()) * 100000n +
    BigInt(randomInt(100000))
  ).toString();

  const referenciaInicial = `PREF-QA-${pagamentoId}`;
  const contextoKey = "personal:Atleta";

  const items = [
    {
      planoId: "ATLETA_PRO",
      periodicidade: "Mensal" as const,
      valorCentavos: 1990,
    },
    {
      planoId: "ATLETA_LEARNING_1",
      periodicidade: "Mensal" as const,
      valorCentavos: 4490,
    },
  ];

  let usuarioId: string | null = null;
  let pagamentoCriado = false;
  let mockConfigurado = false;
  let passou = 0;
  let falhou = 0;
  let concluiu = false;

  const assinaturasCriadas = new Map<string, string>();

  async function testar(
    nome: string,
    acao: () => Promise<void>
  ) {
    try {
      await acao();
      passou++;
      console.log("✔", nome);
    } catch (erro) {
      falhou++;
      console.error("✖", nome, erro);
    }
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    // Encontrar usuário sem as duas assinaturas.
    const usuarios = await prisma.usuario.findMany({
      select: { id: true },
      take: 200,
    });

    for (const usuario of usuarios) {
      const existentes = await prisma.assinatura.count({
        where: {
          usuarioId: usuario.id,
          contextoKey,
          plano: {
            in: items.map((item) => item.planoId),
          },
        },
      });

      if (existentes === 0) {
        usuarioId = usuario.id;
        break;
      }
    }

    if (!usuarioId) {
      throw new Error(
        "QA_SEM_USUARIO_LIVRE: necessario usuario QA sem os dois planos"
      );
    }

    console.log("[QA] Usuario:", usuarioId);
    console.log("[QA] Pagamento:", pagamentoId);

    const totalCentavos = items.reduce(
      (soma, item) => soma + item.valorCentavos,
      0
    );

    assert.equal(totalCentavos, 6480);

    // Criar pagamento BUNDLE com snapshot financeiro.
    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId,
        plano: "BUNDLE",
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "64.80",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: referenciaInicial,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
        contextoPerfilId: null,
        meta: {
          bundleItems: items.map((item) => ({
            planoId: item.planoId,
            periodicidade: item.periodicidade,
          })),
          financeiroV1: {
            versao: 1,
            totalCentavos,
            items: items.map((item) => ({
              planoId: item.planoId,
              periodicidade: item.periodicidade,
              valorBaseCentavos: item.valorCentavos,
              valorFinalCentavos: item.valorCentavos,
            })),
          },
        },
      },
    });

    pagamentoCriado = true;

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

    configurarConsultorMercadoPagoQa(async (id) => {
      assert.equal(id, mpId);

      return {
        id: mpId,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId,
        metadata: { pagamentoId },
        transaction_amount: 64.8,
        currency_id: "BRL",
      };
    });

    mockConfigurado = true;

    async function webhook() {
      let status = 0;
      let corpo: any = null;

      const req = {
        query: { "data.id": mpId },
        body: { data: { id: mpId } },
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

    await testar(
      "Webhook aprova bundle valido",
      async () => {
        const resposta = await webhook();

        assert.equal(
          resposta.status,
          200,
          JSON.stringify(resposta.corpo)
        );
        assert.equal(resposta.corpo?.ok, true);
      }
    );

    await testar(
      "Pagamento aprovado e referencia MP correta",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "APROVADO");
        assert.equal(pagamento.providerRef, mpId);
        assert.ok(pagamento.pagoEm);
        assert.equal(pagamento.plano, "BUNDLE");
        assert.equal(pagamento.valor.toString(), "64.8");
      }
    );

    await testar(
      "Duas assinaturas criadas e ativas",
      async () => {
        const assinaturas =
          await prisma.assinatura.findMany({
            where: {
              usuarioId: usuarioId!,
              contextoKey,
              plano: {
                in: items.map((item) => item.planoId),
              },
            },
          });

        assert.equal(assinaturas.length, 2);

        for (const item of items) {
          const assinatura = assinaturas.find(
            (a) => a.plano === item.planoId
          );

          assert.ok(
            assinatura,
            `Assinatura ausente: ${item.planoId}`
          );
          assert.equal(assinatura.status, "ATIVA");
          assert.equal(assinatura.ativo, true);
          assert.equal(assinatura.periodicidade, "Mensal");
          assert.ok(assinatura.renovaEm);

          assinaturasCriadas.set(
            item.planoId,
            assinatura.id
          );
        }
      }
    );

    await testar(
      "Dois beneficios registrados corretamente",
      async () => {
        const beneficios =
          await prisma.pagamentoBeneficio.findMany({
            where: { pagamentoId },
          });

        assert.equal(beneficios.length, 2);

        for (const item of items) {
          const beneficio = beneficios.find(
            (b) => b.itemKey === item.planoId
          );

          assert.ok(
            beneficio,
            `Beneficio ausente: ${item.planoId}`
          );

          assert.equal(beneficio.tipo, "ASSINATURA");
          assert.equal(beneficio.usuarioId, usuarioId);
          assert.equal(beneficio.revogadoEm, null);
          assert.equal(
            beneficio.recursoId,
            assinaturasCriadas.get(item.planoId)
          );
        }
      }
    );

    await testar(
      "Webhook repetido retorna idempotencia",
      async () => {
        const resposta = await webhook();

        assert.equal(resposta.status, 200);
        assert.equal(resposta.corpo?.idempotent, true);
      }
    );

    await testar(
      "Repeticao nao duplica beneficios",
      async () => {
        const total =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(total, 2);
      }
    );

    await testar(
      "Repeticao nao duplica assinaturas",
      async () => {
        const total = await prisma.assinatura.count({
          where: {
            usuarioId: usuarioId!,
            contextoKey,
            plano: {
              in: items.map((item) => item.planoId),
            },
          },
        });

        assert.equal(total, 2);
      }
    );

    concluiu = falhou === 0;

    console.log(
      `\nRESULTADO: ${passou}/${passou + falhou}`
    );
  } finally {
    if (mockConfigurado) {
      const { configurarConsultorMercadoPagoQa } =
        await import(
          "./server/services/billingMercadoPagoGateway.js"
        );

      configurarConsultorMercadoPagoQa(null);
    }

    // Não limpar registros inesperados.
    // Em caso de falha, preservar tudo para auditoria.
    try {
      if (
        concluiu &&
        pagamentoCriado &&
        usuarioId &&
        assinaturasCriadas.size === 2
      ) {
        await prisma.$transaction(async (tx) => {
          const beneficios =
            await tx.pagamentoBeneficio.findMany({
              where: { pagamentoId },
            });

          if (beneficios.length !== 2) {
            throw new Error("QA_CLEANUP_BENEFICIOS_INVALIDOS");
          }

          for (const item of items) {
            const assinaturaId =
              assinaturasCriadas.get(item.planoId);

            const beneficio = beneficios.find(
              (b) => b.itemKey === item.planoId
            );

            if (
              !assinaturaId ||
              !beneficio ||
              beneficio.recursoId !== assinaturaId ||
              beneficio.usuarioId !== usuarioId
            ) {
              throw new Error(
                "QA_CLEANUP_RELACAO_INESPERADA"
              );
            }

            const assinatura =
              await tx.assinatura.findUniqueOrThrow({
                where: { id: assinaturaId },
              });

            if (
              assinatura.usuarioId !== usuarioId ||
              assinatura.plano !== item.planoId ||
              assinatura.contextoKey !== contextoKey
            ) {
              throw new Error(
                "QA_CLEANUP_ASSINATURA_INESPERADA"
              );
            }
          }

          await tx.pagamentoBeneficio.deleteMany({
            where: { pagamentoId },
          });

          for (const assinaturaId of assinaturasCriadas.values()) {
            await tx.assinatura.delete({
              where: { id: assinaturaId },
            });
          }

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });

        console.log(
          "[QA] Pagamento, 2 beneficios e 2 assinaturas removidos."
        );
      } else if (pagamentoCriado) {
        console.warn(
          "[QA] Registros preservados para auditoria:",
          pagamentoId
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  if (falhou > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});