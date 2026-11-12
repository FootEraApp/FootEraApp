
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  // SEGURANÇA: validar ambiente antes dos imports.
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "true" ||
    process.env.ENABLE_BILLING_SCHEDULER === "true" ||
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(
      url.hostname
    ) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "QA_ABORTADO: ambiente financeiro nao e o banco QA isolado"
    );
  }

  const { prisma } = await import(
    "./server/prisma.js"
  );

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

  const mpId = (
    BigInt(Date.now()) * 100000n +
    BigInt(Math.floor(Math.random() * 100000))
  ).toString();

  const providerRefInicial =
    `PREF-QA-${pagamentoId}`;

  const plano = "ATLETA_PRO";
  const contextoKey = "personal:Atleta";

  let assinaturaCriadaId: string | null = null;
  let pagamentoCriado = false;
  let passou = 0;
  let falhou = 0;
  let sucessoCompleto = false;

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

  async function webhook() {
    let status = 0;
    let corpo: any = null;

    const req = {
      query: {
        "data.id": mpId,
        type: "payment",
      },
      body: {
        type: "payment",
        action: "payment.updated",
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
      json(dados: unknown) {
        corpo = dados;
        return this;
      },
    };

    await mercadoPagoWebhook(
      req as any,
      res as any
    );

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

    // Selecionar um usuário QA sem a assinatura-alvo.
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
      },
      take: 200,
    });

    let usuarioId: string | null = null;

    for (const usuario of usuarios) {
      const assinaturaExistente =
        await prisma.assinatura.findUnique({
          where: {
            usuarioId_plano_contextoKey: {
              usuarioId: usuario.id,
              plano,
              contextoKey,
            },
          },
          select: {
            id: true,
          },
        });

      if (!assinaturaExistente) {
        usuarioId = usuario.id;
        break;
      }
    }

    if (!usuarioId) {
      throw new Error(
        "QA_SEM_USUARIO_LIVRE: nenhum usuario sem ATLETA_PRO encontrado"
      );
    }

    console.log(
      "[QA] Usuario selecionado:",
      usuarioId
    );

    // Criar somente um pagamento desta execução.
    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId,
        plano,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "25.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef: providerRefInicial,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
        contextoPerfilId: null,
      },
    });

    pagamentoCriado = true;

    configurarConsultorMercadoPagoQa(
      async (id) => {
        if (id !== mpId) {
          throw new Error(
            "QA_MP_ID_DIVERGENTE"
          );
        }

        return {
          id: mpId,
          status: "approved",
          status_detail: "accredited",
          external_reference: pagamentoId,
          metadata: {
            pagamentoId,
          },
          transaction_amount: 25,
          currency_id: "BRL",
        };
      }
    );

    await testar(
      "Dois webhooks simultaneos concluem sem duplicidade",
      async () => {
        const respostas = await Promise.all([
          webhook(),
          webhook(),
        ]);

        console.log(
          "[QA] Respostas simultaneas:",
          respostas
        );

        assert.deepEqual(
          respostas.map((r) => r.status).sort(),
          [200, 200],
          "Os dois webhooks devem ser reconhecidos como processados."
        );

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "APROVADO");

        const beneficios =
          await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

        assert.equal(
          beneficios,
          1,
          "A concorrencia nao pode duplicar beneficios."
        );

        const assinaturas =
          await prisma.assinatura.count({
            where: {
              usuarioId: usuarioId!,
              plano,
              contextoKey,
            },
          });

        assert.equal(
          assinaturas,
          1,
          "A concorrencia nao pode duplicar assinaturas."
        );
      }
    );

    await testar(
      "Pagamento aprovado e providerRef atualizado",
      async () => {
        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });

        assert.equal(
          pagamento.status,
          "APROVADO"
        );
        assert.equal(
          pagamento.providerRef,
          mpId
        );
        assert.ok(pagamento.pagoEm);
      }
    );

    await testar(
      "Assinatura ATLETA_PRO foi criada",
      async () => {
        const assinatura =
          await prisma.assinatura.findUnique({
            where: {
              usuarioId_plano_contextoKey: {
                usuarioId: usuarioId!,
                plano,
                contextoKey,
              },
            },
          });

        assert.ok(assinatura);
        assinaturaCriadaId = assinatura.id;
        assert.equal(assinatura.status, "ATIVA");
        assert.equal(assinatura.ativo, true);
        assert.ok(assinatura.renovaEm);
      }
    );

    await testar(
      "Beneficio foi registrado uma vez",
      async () => {
        const beneficios =
          await prisma.pagamentoBeneficio.findMany({
            where: {
              pagamentoId,
            },
          });

        assert.equal(beneficios.length, 1);
        assert.equal(
          beneficios[0].tipo,
          "ASSINATURA"
        );
        assert.equal(
          beneficios[0].recursoId,
          assinaturaCriadaId
        );
        assert.equal(
          beneficios[0].revogadoEm,
          null
        );
      }
    );

    await testar(
      "Webhook aprovado repetido e idempotente",
      async () => {
        const resposta = await webhook();

        assert.equal(resposta.status, 200);
        assert.equal(
          resposta.corpo?.idempotent,
          true
        );

        const quantidade =
          await prisma.pagamentoBeneficio.count({
            where: {
              pagamentoId,
            },
          });

        assert.equal(quantidade, 1);
      }
    );

    await testar(
      "Repeticao nao duplica assinatura",
      async () => {
        const quantidade =
          await prisma.assinatura.count({
            where: {
              usuarioId: usuarioId!,
              plano,
              contextoKey,
            },
          });

        assert.equal(quantidade, 1);
      }
    );

    await testar(
      "Cancelamento tardio nao revoga acesso",
      async () => {
        configurarConsultorMercadoPagoQa(
          async () => ({
            id: mpId,
            status: "cancelled",
            external_reference: pagamentoId,
            metadata: {
              pagamentoId,
            },
            transaction_amount: 25,
            currency_id: "BRL",
          })
        );

        const resposta = await webhook();

        assert.equal(resposta.status, 503);
        assert.equal(
          resposta.corpo?.code,
          "BILLING_MP_REQUIRES_RECONCILIATION"
        );

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });

        assert.equal(pagamento.status, "APROVADO");

        const assinatura =
          await prisma.assinatura.findUniqueOrThrow({
            where: {
              usuarioId_plano_contextoKey: {
                usuarioId: usuarioId!,
                plano,
                contextoKey,
              },
            },
          });

        assert.equal(assinatura.ativo, true);
      }
    );

    sucessoCompleto = falhou === 0;
  } finally {
    configurarConsultorMercadoPagoQa(null);

    // Limpeza exclusiva de registros desta execução.
    // Não apagar uma assinatura pré-existente.
    // Se alguma verificação falhar, preservar os
    // registros para investigação no QA.
    if (pagamentoCriado && sucessoCompleto) {
      await prisma.$transaction(
        async (tx) => {
          const beneficios =
            await tx.pagamentoBeneficio.findMany({
              where: { pagamentoId },
            });

          if (
            beneficios.length !== 1 ||
            !assinaturaCriadaId ||
            beneficios[0].recursoId !== assinaturaCriadaId
          ) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: beneficio inesperado"
            );
          }

          const assinatura =
            await tx.assinatura.findUnique({
              where: {
                id: assinaturaCriadaId,
              },
            });

          if (
            !assinatura ||
            assinatura.plano !== plano ||
            assinatura.contextoKey !== contextoKey
          ) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: assinatura inesperada"
            );
          }

          await tx.pagamentoBeneficio.deleteMany({
            where: { pagamentoId },
          });

          await tx.assinatura.delete({
            where: {
              id: assinaturaCriadaId,
            },
          });

          await tx.pagamento.delete({
            where: {
              id: pagamentoId,
            },
          });
        }
      );

      console.log(
        "[QA] Pagamento, beneficio e assinatura de teste removidos."
      );
    } else if (pagamentoCriado) {
      console.warn(
        "[QA] Registros preservados para auditoria.",
        { pagamentoId }
      );
    }

    await prisma.$disconnect();
  }

  console.log(
    `\nRESULTADO: ${passou}/${passou + falhou}`
  );

  if (falhou > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});