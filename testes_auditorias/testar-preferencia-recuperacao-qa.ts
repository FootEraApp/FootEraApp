
import assert from "node:assert/strict";

async function main() {
  const {
    recuperarPreferenciaMercadoPago,
  } = await import(
    "./server/services/billingPreferenciaRecuperacaoService.js"
  );

  const pagamentoId =
    "11111111-1111-4111-8111-111111111111";

  const preferenciaId = "pref_qa_123";

  let chamadas = 0;

  function mock(dados: Record<string, unknown>) {
    return (async () => {
      chamadas++;

      return new Response(JSON.stringify(dados), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }) as typeof fetch;
  }

  const respostaValida = {
    id: preferenciaId,
    external_reference: pagamentoId,
    init_point:
      "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_qa_123",
    preference_expired: false,
    items: [
      {
        quantity: 1,
        unit_price: 19.9,
        currency_id: "BRL",
      },
    ],
  };

  const entrada = {
    preferenciaId,
    pagamentoId,
    valorCentavos: 1990,
    token: "TOKEN_FICTICIO_QA",
  };

  const resultado =
    await recuperarPreferenciaMercadoPago({
      ...entrada,
      fetchImpl: mock(respostaValida),
    });

  assert.equal(resultado.preferenciaId, preferenciaId);
  assert.ok(resultado.checkoutUrl.startsWith("https://"));
  console.log("✔ Preferencia valida recuperada");

  await assert.rejects(
    recuperarPreferenciaMercadoPago({
      ...entrada,
      fetchImpl: mock({
        ...respostaValida,
        external_reference: "outro-pagamento",
      }),
    }),
    /PREFERENCIA_IDENTIDADE_DIVERGENTE/
  );
  console.log("✔ Identidade divergente bloqueada");

  await assert.rejects(
    recuperarPreferenciaMercadoPago({
      ...entrada,
      fetchImpl: mock({
        ...respostaValida,
        items: [
          {
            quantity: 1,
            unit_price: 29.9,
            currency_id: "BRL",
          },
        ],
      }),
    }),
    /PREFERENCIA_VALOR_DIVERGENTE/
  );
  console.log("✔ Valor divergente bloqueado");

  await assert.rejects(
    recuperarPreferenciaMercadoPago({
      ...entrada,
      fetchImpl: mock({
        ...respostaValida,
        preference_expired: true,
      }),
    }),
    /PREFERENCIA_EXPIRADA/
  );
  console.log("✔ Preferencia expirada bloqueada");

  await assert.rejects(
    recuperarPreferenciaMercadoPago({
      ...entrada,
      fetchImpl: mock({
        ...respostaValida,
        init_point: "https://site-falso.com/checkout",
      }),
    }),
    /PREFERENCIA_URL_INVALIDA/
  );
  console.log("✔ URL externa bloqueada");

  assert.equal(chamadas, 5);

  console.log("\nRESULTADO: 5/5");
}

main().catch((erro) => {
  console.error("QA FALHOU:", erro);
  process.exitCode = 1;
});