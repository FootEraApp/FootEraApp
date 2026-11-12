
import assert from "node:assert/strict";
import {
  buscarPagamentoPorReferenciaExternaMercadoPago,
  classificarConciliacaoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

async function main() {
  const pagamentoId =
    "12345678-1234-1234-1234-123456789012";

  const pagamentoExterno = {
    id: 987654321,
    external_reference: pagamentoId,
    metadata: { pagamentoId },
    status: "approved",
    status_detail: "accredited",
    transaction_amount: 25,
    currency_id: "BRL",
  };

  let chamadas = 0;

  const simular = (dados: unknown): typeof fetch =>
    async (input, init) => {
      chamadas++;

      const url = new URL(String(input));

      assert.equal(
        url.pathname,
        "/v1/payments/search"
      );

      assert.equal(
        url.searchParams.get("external_reference"),
        pagamentoId
      );

      assert.equal(init?.method, "GET");

      return new Response(JSON.stringify(dados), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    };

  const encontrado =
    await buscarPagamentoPorReferenciaExternaMercadoPago(
      pagamentoId,
      {
        token: "TOKEN_FICTICIO",
        fetchImpl: simular({
          paging: { total: 1 },
          results: [pagamentoExterno],
        }),
      }
    );

  assert.equal(String(encontrado?.id), "987654321");

  console.log("✔ Pagamento único localizado");

  const classificacao = classificarConciliacaoMercadoPago(
    {
      id: pagamentoId,
      provider: "MERCADOPAGO",
      providerRef: null,
      valor: "25.00",
      moeda: "BRL",
      status: "PENDENTE",
    },
    encontrado!
  );

  assert.equal(classificacao.acao, "APROVAR");

  console.log("✔ Identidade, valor e moeda validados");

  const ausente =
    await buscarPagamentoPorReferenciaExternaMercadoPago(
      pagamentoId,
      {
        token: "TOKEN_FICTICIO",
        fetchImpl: simular({
          paging: { total: 0 },
          results: [],
        }),
      }
    );

  assert.equal(ausente, null);

  console.log("✔ Busca vazia não inventa pagamento");

  await assert.rejects(
    buscarPagamentoPorReferenciaExternaMercadoPago(
      pagamentoId,
      {
        token: "TOKEN_FICTICIO",
        fetchImpl: simular({
          paging: { total: 2 },
          results: [
            pagamentoExterno,
            { ...pagamentoExterno, id: 987654322 },
          ],
        }),
      }
    ),
    /MP_SEARCH_AMBIGUOUS/
  );

  console.log("✔ Múltiplos pagamentos são bloqueados");

  await assert.rejects(
    buscarPagamentoPorReferenciaExternaMercadoPago(
      pagamentoId,
      {
        token: "TOKEN_FICTICIO",
        fetchImpl: simular({
          paging: { total: 1 },
          results: [{
            ...pagamentoExterno,
            external_reference: "OUTRO_PAGAMENTO",
          }],
        }),
      }
    ),
    /MP_SEARCH_IDENTITY_MISMATCH/
  );

  console.log("✔ Identidade divergente bloqueada");

  assert.equal(chamadas, 4);

  console.log("\nRESULTADO: 5/5");
}

main().catch((erro) => {
  console.error("QA_BUSCA_CHECKOUT_FALHOU:", erro);
  process.exitCode = 1;
});