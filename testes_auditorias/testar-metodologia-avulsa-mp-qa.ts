
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";

async function main() {
  // SEGURANÇA: antes de importar o Prisma.
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
      "QA_ABORTADO: banco financeiro inseguro"
    );
  }

  const { prisma } = await import("./server/prisma.js");

  const pagamentoId = randomUUID();
  const mpId = (
    BigInt(Date.now()) * 100000n +
    BigInt(randomInt(100000))
  ).toString();

  let pagamentoCriado = false;
  let mockConfigurado = false;
  let concluiu = false;
  let aprovados = 0;
  let falhas = 0;

  let compradorId = "";
  let metodologiaId = "";
  let creatorId = "";
  let valor = "";
  let acessoCriadoId = "";

  async function testar(
    nome: string,
    executar: () => Promise<void>
  ) {
    try {
      await executar();
      aprovados++;
      console.log("✔", nome);
    } catch (erro) {
      falhas++;
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

    // Buscar metodologia ativa com Creator pessoal.
    const metodologias =
      await prisma.metodologiaAvulsa.findMany({
        where: {
          ativo: true,
          criadorUsuarioId: {
            not: null,
          },
          clubeId: null,
          escolinhaId: null,
          marcaId: null,
          federacaoId: null,
          precoAssinaturaMensal: {
            gt: 0,
          },
        },
        select: {
          id: true,
          titulo: true,
          criadorUsuarioId: true,
          precoAssinaturaMensal: true,
        },
        take: 100,
      });

    const usuarios = await prisma.usuario.findMany({
      select: { id: true },
      take: 200,
    });

    for (const metodologia of metodologias) {
      if (!metodologia.criadorUsuarioId) continue;

      const creator = await prisma.creator.findUnique({
        where: {
          usuarioId: metodologia.criadorUsuarioId,
        },
        select: {
          id: true,
          ativo: true,
          tipo: true,
        },
      });

      if (
        !creator ||
        !creator.ativo ||
        creator.tipo !== "PESSOA_FISICA"
      ) {
        continue;
      }

      for (const usuario of usuarios) {
        if (usuario.id === metodologia.criadorUsuarioId) {
          continue;
        }

        const acessoExistente =
          await prisma.metodologiaAssinante.findUnique({
            where: {
              metodologiaAvulsaId_usuarioId: {
                metodologiaAvulsaId: metodologia.id,
                usuarioId: usuario.id,
              },
            },
          });

        if (acessoExistente) continue;

        const vendaExistente =
          await prisma.creatorVenda.findFirst({
            where: {
              compradorId: usuario.id,
              metodologiaAvulsaId: metodologia.id,
              status: "CONFIRMADA",
            },
            select: { id: true },
          });

        if (vendaExistente) continue;

        compradorId = usuario.id;
        metodologiaId = metodologia.id;
        creatorId = creator.id;
        valor = metodologia.precoAssinaturaMensal.toFixed(2);
        break;
      }

      if (compradorId) break;
    }

    if (!compradorId || !metodologiaId) {
      throw new Error(
        "QA_SEM_DADOS: precisa de metodologia ativa, Creator pessoal ativo e comprador sem acesso."
      );
    }

    const planoId =
      `METODOLOGIA_AVULSA:${metodologiaId}`;

    const valorCentavos = Math.round(
      Number(valor) * 100
    );

    assert.ok(valorCentavos > 0);

    console.log("[QA] Comprador:", compradorId);
    console.log("[QA] Metodologia:", metodologiaId);
    console.log("[QA] Creator:", creatorId);
    console.log("[QA] Valor:", valor);
    console.log("[QA] Pagamento:", pagamentoId);

    // Pagamento criado somente para este teste.
    // financeiroV1 fixa o valor do cenário QA.
    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId: compradorId,
        plano: planoId,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor,
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: `PREF-QA-${pagamentoId}`,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
        contextoPerfilId: null,
        meta: {
          financeiroV1: {
            versao: 1,
            totalCentavos: valorCentavos,
            items: [
              {
                planoId,
                periodicidade: "Mensal",
                valorBaseCentavos: valorCentavos,
                valorFinalCentavos: valorCentavos,
              },
            ],
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

    configurarConsultorMercadoPagoQa(
      async (id) => {
        assert.equal(id, mpId);

        return {
          id: mpId,
          status: "approved",
          status_detail: "accredited",
          external_reference: pagamentoId,
          metadata: { pagamentoId },
          transaction_amount: Number(valor),
          currency_id: "BRL",
        };
      }
    );

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
        json(dados: unknown) {
          corpo = dados;
          return this;
        },
      };

      await mercadoPagoWebhook(req as any, res as any);

      return { status, corpo };
    }

    await testar(
      "Webhook aprova metodologia avulsa",
      async () => {
        const resposta = await webhook();

        assert.equal(
          resposta.status,
          200,
          JSON.stringify(resposta.corpo)
        );
      }
    );

    await testar(
      "Pagamento aprovado e referencia correta",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "APROVADO");
        assert.equal(pagamento.providerRef, mpId);
        assert.ok(pagamento.pagoEm);
      }
    );

    await testar(
      "Acesso AVULSA ativo e com validade",
      async () => {
        const acesso =
          await prisma.metodologiaAssinante.findUnique({
            where: {
              metodologiaAvulsaId_usuarioId: {
                metodologiaAvulsaId: metodologiaId,
                usuarioId: compradorId,
              },
            },
          });

        assert.ok(acesso);
        assert.equal(acesso.origem, "AVULSA");
        assert.equal(acesso.status, "ATIVA");
        assert.equal(acesso.metodologiaId, null);
        assert.ok(acesso.expiraEm);
        assert.ok(acesso.expiraEm > new Date());

        acessoCriadoId = acesso.id;
      }
    );

    await testar(
      "Venda do Creator confirmada",
      async () => {
        const vendas = await prisma.creatorVenda.findMany({
          where: { pagamentoId },
        });

        assert.equal(vendas.length, 1);
        assert.equal(vendas[0].creatorId, creatorId);
        assert.equal(vendas[0].compradorId, compradorId);
        assert.equal(
          vendas[0].metodologiaAvulsaId,
          metodologiaId
        );
        assert.equal(vendas[0].status, "CONFIRMADA");
        assert.ok(vendas[0].pagoEm);
      }
    );

    await testar(
      "Beneficio da metodologia registrado",
      async () => {
        const beneficios =
          await prisma.pagamentoBeneficio.findMany({
            where: { pagamentoId },
          });

        assert.equal(beneficios.length, 1);
        assert.equal(
          beneficios[0].tipo,
          "METODOLOGIA_AVULSA"
        );
        assert.equal(
          beneficios[0].recursoId,
          metodologiaId
        );
        assert.equal(beneficios[0].itemKey, planoId);
        assert.equal(beneficios[0].revogadoEm, null);
      }
    );

    const primeiraValidade =
      await prisma.metodologiaAssinante.findUnique({
        where: {
          metodologiaAvulsaId_usuarioId: {
            metodologiaAvulsaId: metodologiaId,
            usuarioId: compradorId,
          },
        },
        select: {
          id: true,
          expiraEm: true,
        },
      });

    await testar(
      "Webhook repetido e idempotente",
      async () => {
        const resposta = await webhook();

        assert.equal(resposta.status, 200);
        assert.equal(resposta.corpo?.idempotent, true);
      }
    );

    await testar(
      "Repeticao nao duplica acesso ou venda",
      async () => {
        const acessos =
          await prisma.metodologiaAssinante.count({
            where: {
              metodologiaAvulsaId: metodologiaId,
              usuarioId: compradorId,
            },
          });

        const vendas = await prisma.creatorVenda.count({
          where: { pagamentoId },
        });

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        const acesso =
          await prisma.metodologiaAssinante.findUniqueOrThrow({
            where: {
              metodologiaAvulsaId_usuarioId: {
                metodologiaAvulsaId: metodologiaId,
                usuarioId: compradorId,
              },
            },
          });

        assert.equal(acessos, 1);
        assert.equal(vendas, 1);
        assert.equal(beneficios, 1);
        assert.equal(acesso.id, primeiraValidade?.id);
        assert.equal(
          acesso.expiraEm?.getTime(),
          primeiraValidade?.expiraEm?.getTime()
        );
      }
    );

    concluiu = falhas === 0;

    console.log(
      `\nRESULTADO: ${aprovados}/${aprovados + falhas}`
    );
  } finally {
    if (mockConfigurado) {
      const { configurarConsultorMercadoPagoQa } =
        await import(
          "./server/services/billingMercadoPagoGateway.js"
        );
      configurarConsultorMercadoPagoQa(null);
    }

    try {
      if (
        concluiu &&
        pagamentoCriado &&
        compradorId &&
        metodologiaId &&
        acessoCriadoId
      ) {
        await prisma.$transaction(async (tx) => {
          const vendas =
            await tx.creatorVenda.findMany({
              where: { pagamentoId },
            });

          const beneficios =
            await tx.pagamentoBeneficio.findMany({
              where: { pagamentoId },
            });

          const acesso =
            await tx.metodologiaAssinante.findUnique({
              where: {
                metodologiaAvulsaId_usuarioId: {
                  metodologiaAvulsaId: metodologiaId,
                  usuarioId: compradorId,
                },
              },
            });

          if (
            vendas.length !== 1 ||
            vendas[0].creatorId !== creatorId ||
            vendas[0].compradorId !== compradorId ||
            beneficios.length !== 1 ||
            beneficios[0].recursoId !== metodologiaId ||
            !acesso ||
            acesso.id !== acessoCriadoId ||
            acesso.origem !== "AVULSA"
          ) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: registros inesperados"
            );
          }

          await tx.creatorVenda.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamentoBeneficio.deleteMany({
            where: { pagamentoId },
          });

          await tx.metodologiaAssinante.delete({
            where: { id: acessoCriadoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });

        console.log(
          "[QA] Pagamento, venda, beneficio e acesso de teste removidos."
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

  if (falhas > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});