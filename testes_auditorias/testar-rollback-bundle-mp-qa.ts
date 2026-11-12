
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  // 1. Proteger o banco antes de importar o Prisma.
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
    throw new Error("QA_ABORTADO: banco ou ambiente inseguro");
  }

  const { prisma } = await import("./server/prisma.js");

  let pagamentoCriado = false;
  let liberarMock: (() => void) | null = null;

  const pagamentoId = randomUUID();
  const eventoInexistenteId = randomUUID();
  const mpId = (
    BigInt(Date.now()) * 100000n + 67891n
  ).toString();

  const planoValido = "ATLETA_PRO";
  const planoInvalido = `EVENTO:${eventoInexistenteId}`;
  const contextoKey = "personal:Atleta";

  let usuarioId: string | null = null;
  let passou = 0;
  let falhou = 0;

  async function testar(
    descricao: string,
    fn: () => Promise<void>
  ) {
    try {
      await fn();
      passou++;
      console.log("✔", descricao);
    } catch (erro) {
      falhou++;
      console.error("✖", descricao, erro);
    }
  }

  try {
    // 2. Conferir o nome do banco conectado.
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    // Evitar modificar assinatura já existente.
    const usuarios = await prisma.usuario.findMany({
      select: { id: true },
      take: 200,
    });

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

    // Confirmar que o evento usado para falhar
    // realmente não existe no banco QA.
    const evento = await prisma.evento.findUnique({
      where: { id: eventoInexistenteId },
      select: { id: true },
    });

    assert.equal(evento, null);

    console.log("[QA] Usuario:", usuarioId);
    console.log("[QA] Pagamento:", pagamentoId);

    // 3. Criar bundle com snapshot local.
    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId,
        plano: "BUNDLE",
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "30.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: `PREF-QA-${pagamentoId}`,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
        contextoPerfilId: null,
        meta: {
          bundleItems: [
            {
              planoId: planoValido,
              periodicidade: "Mensal",
            },
            {
              planoId: planoInvalido,
              periodicidade: "Mensal",
            },
          ],
          financeiroV1: {
            versao: 1,
            totalCentavos: 3000,
            items: [
              {
                planoId: planoValido,
                periodicidade: "Mensal",
                valorBaseCentavos: 1990,
                valorFinalCentavos: 1990,
              },
              {
                planoId: planoInvalido,
                periodicidade: "Mensal",
                valorBaseCentavos: 1010,
                valorFinalCentavos: 1010,
              },
            ],
          },
        },
      },
    });

    pagamentoCriado = true;

    // Importar o controller depois da validação QA.
    const { configurarConsultorMercadoPagoQa } =
      await import(
        "./server/services/billingMercadoPagoGateway.js"
      );

    const { mercadoPagoWebhook } = await import(
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
        transaction_amount: 30,
        currency_id: "BRL",
      };
    });

    liberarMock = () =>
      configurarConsultorMercadoPagoQa(null);

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

    // 4. O segundo item deve falhar.
    await testar(
      "Falha no segundo item impede aprovacao",
      async () => {
        const resposta = await webhook();

        assert.notEqual(
          resposta.status,
          200,
          JSON.stringify(resposta.corpo)
        );
      }
    );

    // 5. A aprovação deve ter sido revertida.
    await testar(
      "Pagamento permanece PENDENTE",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.pagoEm, null);

        // A associação da referência MP acontece
        // antes da transação de provisionamento.
        assert.equal(pagamento.providerRef, mpId);
      }
    );

    await testar(
      "Nenhum beneficio do bundle sobrevive",
      async () => {
        const total =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(total, 0);
      }
    );

    await testar(
      "Assinatura do primeiro item foi revertida",
      async () => {
        const total = await prisma.assinatura.count({
          where: {
            usuarioId: usuarioId!,
            plano: planoValido,
            contextoKey,
          },
        });

        assert.equal(total, 0);
      }
    );

    // 6. Repetir a tentativa.
    await testar(
      "Nova tentativa falha sem conceder parcialmente",
      async () => {
        const resposta = await webhook();

        assert.notEqual(resposta.status, 200);

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "PENDENTE");

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(beneficios, 0);

        const assinaturas =
          await prisma.assinatura.count({
            where: {
              usuarioId: usuarioId!,
              plano: planoValido,
              contextoKey,
            },
          });

        assert.equal(assinaturas, 0);
      }
    );

    console.log(
      `\nRESULTADO: ${passou}/${passou + falhou}`
    );

    if (falhou > 0) {
      process.exitCode = 1;
    }
  } finally {
    try {
      liberarMock?.();

      // Excluir somente o pagamento criado nesta
      // execução e somente se nenhuma concessão
      // parcial estiver presente.
      if (pagamentoCriado) {
        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        const assinaturas = usuarioId
          ? await prisma.assinatura.count({
              where: {
                usuarioId,
                plano: planoValido,
                contextoKey,
              },
            })
          : -1;

        if (beneficios === 0 && assinaturas === 0) {
          await prisma.pagamento.delete({
            where: { id: pagamentoId },
          });

          console.log(
            "[QA] Pagamento de teste removido."
          );
        } else {
          console.warn(
            "[QA] Limpeza interrompida para auditoria:",
            {
              pagamentoId,
              beneficios,
              assinaturas,
            }
          );
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});