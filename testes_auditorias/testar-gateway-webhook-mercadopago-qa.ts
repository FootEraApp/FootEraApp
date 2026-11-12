
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";

import {
  configurarConsultorMercadoPagoQa,
} from "./server/services/billingMercadoPagoGateway.js";

import {
  mercadoPagoWebhook,
} from "./server/controllers/billingController.js";

// Teste do controller real com consulta MP simulada.
// Não cria pagamentos ou modifica benefícios.
// Obrigatório executar no banco QA isolado.

const db = new URL(
  process.env.DATABASE_URL ?? "http://invalid"
);

if (
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.MP_ACCESS_TOKEN) ||
  process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
  !["127.0.0.1", "localhost"].includes(db.hostname) ||
  db.port !== "5433" ||
  db.pathname !== "/footera_billing_qa"
) {
  throw new Error(
    "SEGURANCA: este teste exige footera_billing_qa local e MP_ACCESS_TOKEN vazio"
  );
}

const id = String(
  BigInt(Date.now()) * 100000n +
  BigInt(randomInt(100000))
);

let passou = 0;
let falhou = 0;

async function executarWebhook(paymentId: string) {
  let status = 0;
  let body: any = null;

  const req = {
    query: {
      "data.id": paymentId,
      type: "payment",
    },
    body: {
      type: "payment",
      data: {
        id: paymentId,
      },
    },
  };

  const res = {
    status(codigo: number) {
      status = codigo;
      return this;
    },
    json(valor: unknown) {
      body = valor;
      return this;
    },
  };

  await mercadoPagoWebhook(
    req as any,
    res as any
  );

  return { status, body };
}

async function testar(
  nome: string,
  fn: () => Promise<void>
) {
  try {
    await fn();
    passou++;
    console.log("✔", nome);
  } catch (erro) {
    falhou++;
    console.error("✖", nome, erro);
  }
}

async function main() {
  try {
    configurarConsultorMercadoPagoQa(async () => ({
      id,
      status: "pending",
      external_reference: "qa-inexistente",
      metadata: {
        pagamentoId: "qa-inexistente",
      },
      transaction_amount: 25,
      currency_id: "BRL",
    }));

    await testar(
      "Pagamento inexistente nao e aprovado",
      async () => {
        const r = await executarWebhook(id);
        assert.equal(r.status, 503);
        assert.equal(
          r.body.code,
          "BILLING_PAYMENT_NOT_FOUND"
        );
      }
    );

    await testar(
      "Webhook repetido nao cria pagamento",
      async () => {
        const primeiro =
          await executarWebhook(id);
        const segundo =
          await executarWebhook(id);

        assert.equal(primeiro.status, 503);
        assert.equal(segundo.status, 503);
      }
    );

    configurarConsultorMercadoPagoQa(async () => ({
      id: "999999999",
      status: "approved",
    }));

    await testar(
      "ID devolvido pelo provedor divergente",
      async () => {
        const r = await executarWebhook(id);

        assert.equal(r.status, 503);
        assert.equal(
          r.body.code,
          "BILLING_MP_PAYMENT_ID_MISMATCH"
        );
      }
    );

    await testar(
      "ID invalido bloqueado antes da consulta",
      async () => {
        const r = await executarWebhook("../123");

        assert.equal(r.status, 400);
        assert.equal(
          r.body.code,
          "MP_PAYMENT_ID_INVALID"
        );
      }
    );

    configurarConsultorMercadoPagoQa(
      async () => {
        throw new Error("QA_FALHA_MP_SIMULADA");
      }
    );

    await testar(
      "Falha simulada do Mercado Pago foi bloqueada corretamente",
      async () => {
        const r = await executarWebhook(id);

        assert.notEqual(r.status, 200);
        assert.ok(r.body);
      }
    );
  } finally {
    configurarConsultorMercadoPagoQa(null);
  }

  console.log(
    `\nRESULTADO: ${passou}/${passou + falhou}`
  );

  if (falhou) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});