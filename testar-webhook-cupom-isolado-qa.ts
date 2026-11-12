
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import express from "express";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa" ||
    !process.env.MP_WEBHOOK_SECRET
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const checkout = await import(
    "./server/services/billingCheckoutOperacaoService.js"
  );

  const { configurarConsultorMercadoPagoQa } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const { default: billingRoutes } = await import(
    "./server/routes/billing.js"
  );

  const usuarioId = randomUUID();
  const marcador = `qa_cupom_${usuarioId.replaceAll("-", "")}`;

  const providerRef =
    `${Date.now()}${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;

  const cupomId = randomUUID();

  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;

  let server:
    | ReturnType<ReturnType<typeof express>["listen"]>
    | null = null;

  let sucesso = false;
  let consultas = 0;

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    // Usuário exclusivo do QA.
    await prisma.usuario.create({
      data: {
        id: usuarioId,
        nomeDeUsuario: marcador,
        senhaHash: "QA_NAO_AUTENTICAR",
        nome: "Atleta Isolado QA",
        email: `${marcador}@example.invalid`,
        tipo: "Atleta",
        verified: false,
      },
    });

    await prisma.atleta.create({
      data: {
        usuarioId,
        idade: 20,
        categoria: [],
      },
    });

    // Cupom de 10% e capacidade de um uso.
    await prisma.cupom.create({
      data: {
        id: cupomId,
        codigo: `QAC${usuarioId
          .replaceAll("-", "")
          .slice(0, 25)}`,
        tipo: "PERCENTUAL",
        descontoPerc: 10,
        plano: "ATLETA_PRO",
        periodicidade: "Mensal",
        ativo: true,
        usosMax: 1,
        usosAtuais: 0,
      },
    });

    const chaveCliente = randomUUID();

    const preparado = await checkout.prepararCheckoutAtomico({
      usuarioId,
      chaveCliente,
      modalidade: "PIX_INDIVIDUAL",

      fingerprintRequisicao: checkout.fingerprintCheckout({
        marcador,
        chaveCliente,
      }),

      criarPagamento: (tx) =>
        tx.pagamento.create({
          data: {
            usuarioId,
            plano: "ATLETA_PRO",
            periodicidade: "Mensal",
            metodo: "PIX",
            status: "PENDENTE",
            provider: "MERCADOPAGO",
            providerRef,
            cupomId,
            valor: "17.91",
            moeda: "BRL",
            contextoKind: "PERSONAL",
            contextoTipo: "Atleta",

            meta: {
              qaWebhookAprovadoIsolado: marcador,

              financeiroV1: {
                versao: 1,
                totalCentavos: 1791,
                items: [
                  {
                    planoId: "ATLETA_PRO",
                    periodicidade: "Mensal",
                    valorBaseCentavos: 1990,
                    valorFinalCentavos: 1791,
                  },
                ],
              },
            },
          },
        }),
    });

    pagamentoId = preparado.pagamento.id;
    operacaoId = preparado.operacao.id;

    // A reserva deve existir antes da aprovação.
    await prisma.cupomReserva.create({
      data: {
        cupomId,
        usuarioId,
        pagamentoId,
        status: "RESERVADA",
        expiraEm: new Date(Date.now() + 2 * 86400000),
      },
    });

    assert.equal(
      await checkout.adquirirEnvioCheckout(operacaoId),
      true
    );

    assert.equal(
      await checkout.marcarCheckoutInconclusivo(
        operacaoId,
        new Error("QA_TIMEOUT")
      ),
      true
    );

    // GET Mercado Pago falso.
    configurarConsultorMercadoPagoQa(async (id) => {
      consultas++;

      assert.equal(id, providerRef);

      return {
        id: providerRef,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId!,
        metadata: { pagamentoId },
        transaction_amount: 17.91,
        currency_id: "BRL",
      };
    });

    // Rota HTTP real, com provedor simulado.
    const app = express();

    app.use(express.json());
    app.use("/api/billing", billingRoutes);

    const iniciado = app.listen(0, "127.0.0.1");
    server = iniciado;

    if (!iniciado.listening) {
      await new Promise<void>((resolve, reject) => {
        iniciado.once("listening", resolve);
        iniciado.once("error", reject);
      });
    }

    const addr = iniciado.address();

    assert.ok(addr && typeof addr !== "string");

    const endpoint =
      `http://127.0.0.1:${addr.port}` +
      `/api/billing/mercadopago/webhook?data.id=${providerRef}`;

    const enviar = async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const reqId = randomUUID();

      const manifest =
        `id:${providerRef};request-id:${reqId};ts:${ts};`;

      const v1 = createHmac(
        "sha256",
        process.env.MP_WEBHOOK_SECRET!
      )
        .update(manifest)
        .digest("hex");

      const resposta = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-request-id": reqId,
          "x-signature": `ts=${ts},v1=${v1}`,
        },

        body: JSON.stringify({
          type: "payment",
          data: { id: providerRef },
        }),
      });

      return {
        status: resposta.status,
        corpo: await resposta.json(),
      };
    };

    // TESTE 1 — Aprovação válida.
    const primeiro = await enviar();

    assert.equal(
      primeiro.status,
      200,
      JSON.stringify(primeiro.corpo)
    );

    const pg1 = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });

    const op1 =
      await prisma.billingCheckoutOperacao.findUniqueOrThrow({
        where: { id: operacaoId },
      });

    assert.equal(pg1.status, "APROVADO");
    assert.equal(pg1.providerRef, providerRef);
    assert.equal(op1.status, "CONFIRMADA");
    assert.equal(op1.providerRef, providerRef);

    console.log(
      "✔ Aprovação válida concluiu pagamento e checkout inconclusivo"
    );

    // TESTE 2 — Consumo único do cupom.
    const benef1 = await prisma.pagamentoBeneficio.count({
      where: { pagamentoId },
    });

    const assinaturas1 = await prisma.assinatura.findMany({
      where: { usuarioId },
    });

    assert.equal(benef1, 1);
    assert.equal(assinaturas1.length, 1);
    assert.equal(assinaturas1[0].status, "ATIVA");

    assert.equal(
      await prisma.cupomResgate.count({
        where: { pagamentoId },
      }),
      1
    );

    const reserva1 =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: { pagamentoId },
      });

    assert.equal(reserva1.status, "CONSUMIDA");
    assert.ok(reserva1.consumidaEm);

    assert.equal(
      (
        await prisma.cupom.findUniqueOrThrow({
          where: { id: cupomId },
        })
      ).usosAtuais,
      1
    );

    console.log(
      "✔ Assinatura, benefício e cupom consumidos uma vez"
    );

    // TESTE 3 — Webhook repetido.
    const segundo = await enviar();

    assert.equal(
      segundo.status,
      200,
      JSON.stringify(segundo.corpo)
    );

    assert.equal(consultas, 2);

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      benef1
    );

    assert.equal(
      await prisma.cupomResgate.count({
        where: { pagamentoId },
      }),
      1
    );

    assert.equal(
      (
        await prisma.cupom.findUniqueOrThrow({
          where: { id: cupomId },
        })
      ).usosAtuais,
      1
    );

    assert.equal(
      (
        await prisma.cupomReserva.findUniqueOrThrow({
          where: { pagamentoId },
        })
      ).status,
      "CONSUMIDA"
    );

    const assinaturas2 = await prisma.assinatura.findMany({
      where: { usuarioId },
    });

    assert.equal(assinaturas2.length, 1);
    assert.equal(assinaturas2[0].id, assinaturas1[0].id);

    const pg2 = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });

    assert.equal(
      pg2.pagoEm?.getTime(),
      pg1.pagoEm?.getTime()
    );

    console.log(
      "✔ Repetição idempotente: sem duplicar benefício, assinatura ou pagamento"
    );

    sucesso = true;

    console.log(
      "\nRESULTADO: 3/3 (webhook aprovado com cupom reservado)"
    );
  } finally {
    configurarConsultorMercadoPagoQa(null);

    if (server) {
      const servidor = server;

      await new Promise<void>((resolve, reject) => {
        servidor.close((erro) =>
          erro ? reject(erro) : resolve()
        );
      });
    }

    try {
      if (sucesso && pagamentoId && operacaoId) {
        // Cópias tipadas para a transação assíncrona.
        const pagamentoIdSeguro: string = pagamentoId;
        const operacaoIdSeguro: string = operacaoId;

        const p =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoIdSeguro },
          });

        const u =
          await prisma.usuario.findUniqueOrThrow({
            where: { id: usuarioId },
          });

        assert.equal(p.usuarioId, usuarioId);

        assert.equal(
          (
            p.meta as {
              qaWebhookAprovadoIsolado?: string;
            }
          )?.qaWebhookAprovadoIsolado,
          marcador
        );

        assert.equal(u.nomeDeUsuario, marcador);

        assert.equal(
          await prisma.cupomReserva.count({
            where: { pagamentoId: pagamentoIdSeguro },
          }),
          1
        );

        assert.equal(
          await prisma.cupomResgate.count({
            where: { pagamentoId: pagamentoIdSeguro },
          }),
          1
        );

        // Limpeza somente após todos os testes passarem.
        await prisma.$transaction(async (tx) => {
          await tx.pagamentoBeneficio.deleteMany({
            where: { pagamentoId: pagamentoIdSeguro },
          });

          await tx.cupomResgate.deleteMany({
            where: {
              pagamentoId: pagamentoIdSeguro,
              cupomId,
            },
          });

          await tx.cupomReserva.deleteMany({
            where: {
              pagamentoId: pagamentoIdSeguro,
              cupomId,
            },
          });

          await tx.assinatura.deleteMany({
            where: { usuarioId },
          });

          await tx.billingCheckoutOperacao.delete({
            where: { id: operacaoIdSeguro },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoIdSeguro },
          });

          await tx.cupom.delete({
            where: { id: cupomId },
          });

          await tx.atleta.delete({
            where: { usuarioId },
          });

          await tx.usuario.delete({
            where: { id: usuarioId },
          });
        });

        console.log("[QA] Fixtures isoladas removidas");
      } else {
        console.warn(
          "[QA] Fixtures preservadas para auditoria:",
          { usuarioId, pagamentoId, operacaoId, marcador }
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(
    "QA_WEBHOOK_CUPOM_ISOLADO_FALHOU:",
    erro
  );

  process.exitCode = 1;
});