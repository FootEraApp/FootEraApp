
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);

const mercadoPago = require("mercadopago");
const requestManager = require(
  "mercadopago/lib/request-manager"
);

async function main() {
  // Impede a obtenção de tokens e o envio HTTP.
  const gerarTokenOriginal =
    requestManager.generateAccessToken;

  const executarOriginal = requestManager.exec;

  const requisicoes: Array<{
    chave: string;
    referencia: string;
    valor: number;
  }> = [];

  requestManager.generateAccessToken =
    async () => "TOKEN_FICTICIO_QA";

  requestManager.exec = async (options: any) => {
    assert.equal(options.method, "POST");
    assert.equal(options.path, "/v1/payments");

    const chave = options.config?.idempotency;

    assert.equal(typeof chave, "string");
    assert.ok(chave.length >= 16);

    requisicoes.push({
      chave,
      referencia: options.payload.external_reference,
      valor: options.payload.transaction_amount,
    });

    // Resposta inteiramente simulada.
    return {
      body: {
        id: 987654321,
        status: "pending",
      },
    };
  };

  try {
    const operacaoIndividual = randomUUID();
    const operacaoBundle = randomUUID();

    const criarPix = async (
      pagamentoId: string,
      chaveOperacao: string,
      valor: number
    ) => {
      return mercadoPago.payment.create(
        {
          transaction_amount: valor,
          description: "PIX teste QA",
          payment_method_id: "pix",
          payer: {
            email: "teste@example.com",
          },
          external_reference: pagamentoId,
        },
        {
          idempotency: chaveOperacao,
        }
      );
    };

    await criarPix(
      "pagamento-individual-qa",
      operacaoIndividual,
      19.9
    );

    await criarPix(
      "pagamento-individual-qa",
      operacaoIndividual,
      19.9
    );

    await criarPix(
      "pagamento-bundle-qa",
      operacaoBundle,
      64.8
    );

    assert.equal(requisicoes.length, 3);
    console.log("✔ Três chamadas interceptadas");

    assert.equal(
      requisicoes[0].chave,
      operacaoIndividual
    );
    console.log("✔ PIX individual usa chave fixa");

    assert.equal(
      requisicoes[1].chave,
      operacaoIndividual
    );
    console.log("✔ Repetição conserva a chave");

    assert.equal(
      requisicoes[2].chave,
      operacaoBundle
    );
    console.log("✔ PIX bundle usa sua chave");

    assert.notEqual(
      requisicoes[0].chave,
      requisicoes[2].chave
    );
    console.log("✔ Operações diferentes usam chaves diferentes");

    assert.deepEqual(
      requisicoes.map((r) => r.valor),
      [19.9, 19.9, 64.8]
    );

    console.log("✔ Valores preservados");
    console.log("\nRESULTADO: 6/6");
  } finally {
    requestManager.generateAccessToken =
      gerarTokenOriginal;

    requestManager.exec = executarOriginal;
  }
}

main().catch((erro) => {
  console.error("QA_IDEMPOTENCIA_SDK_FALHOU:", erro);
  process.exitCode = 1;
});