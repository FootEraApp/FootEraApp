
import assert from "node:assert/strict";

async function main() {
  const {
    testarTransporteEstornoMercadoPagoQa,
    solicitarEstornoMercadoPago,
  } = await import(
    "./server/services/billingEstornoMercadoPagoGateway.js"
  );

  const pagamentoProviderRef = "9988776655";

  const chaveIdempotencia =
    "footera-evento-refund-12345678-1234-1234-1234-123456789012";

  const valorEsperadoCentavos = 2500;

  let verificacoes = 0;

  function ok(nome: string) {
    verificacoes++;
    console.log("✔", nome);
  }

  const chamar = (fetchImpl: typeof fetch) =>
    testarTransporteEstornoMercadoPagoQa({
      pagamentoProviderRef,
      chaveIdempotencia,
      valorEsperadoCentavos,
      token: "TOKEN_QA_FICTICIO",
      fetchImpl,
    });

  await assert.rejects(
    solicitarEstornoMercadoPago(),
    /BILLING_ESTORNO_ENVIO_REAL_DESABILITADO/
  );

  ok("Gateway real permanece bloqueado");

  let totalPosts = 0;

  const sucesso: typeof fetch = async (
    input,
    init
  ) => {
    totalPosts++;

    assert.equal(init?.method, "POST");

    assert.equal(
      String(input),
      "https://api.mercadopago.com/v1/payments/9988776655/refunds"
    );

    const headers = new Headers(init?.headers);

    assert.equal(
      headers.get("X-Idempotency-Key"),
      chaveIdempotencia
    );

    assert.equal(
      headers.get("Authorization"),
      "Bearer TOKEN_QA_FICTICIO"
    );

    assert.deepEqual(
      JSON.parse(String(init?.body)),
      {}
    );

    return new Response(
      JSON.stringify({
        id: 7654321,
        payment_id: 9988776655,
        amount: 25,
        status: "approved",
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  };

  const confirmado = await chamar(sucesso);

  assert.equal(
    confirmado.resultado,
    "CONFIRMADO"
  );

  assert.equal(
    confirmado.estornoProviderRef,
    "7654321"
  );

  assert.equal(totalPosts, 1);

  ok("HTTP simulado confirma estorno vinculado");

  const erroHttp = await chamar(
    async () =>
      new Response(
        JSON.stringify({
          message: "Erro externo",
        }),
        { status: 500 }
      )
  );

  assert.equal(
    erroHttp.resultado,
    "DESCONHECIDO"
    );

  assert.equal(
    erroHttp.statusHttp,
    500
  );

  ok("HTTP 500 não confirma reembolso");

  const timeout = await chamar(
    async () => {
      throw new Error("QA_TIMEOUT");
    }
  );

  assert.equal(
    timeout.resultado,
    "DESCONHECIDO"
  );

  assert.equal(
    timeout.estornoProviderRef,
    null
  );

  ok("Timeout permanece inconclusivo");

  const jsonInvalido = await chamar(
    async () =>
      new Response(
        "isto nao e json",
        { status: 201 }
      )
  );

  assert.equal(
    jsonInvalido.resultado,
    "DESCONHECIDO"
  );

  ok("JSON inválido não confirma estorno");

  const valorIncorreto = await chamar(
    async () =>
      new Response(
        JSON.stringify({
          id: 7654321,
          payment_id: 9988776655,
          amount: 20,
          status: "approved",
        }),
        { status: 201 }
      )
  );

  assert.equal(
    valorIncorreto.resultado,
    "DESCONHECIDO"
  );

  ok("Valor diferente bloqueia confirmação");

  console.log(
    `\nRESULTADO: ${verificacoes}/6`
  );
}

main().catch((erro) => {
  console.error(
    "QA_TRANSPORTE_ESTORNO_FALHOU:",
    erro
  );

  process.exitCode = 1;
});