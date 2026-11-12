
import assert from "node:assert/strict";

import {
  consultarEstornosPagamentoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

async function main() {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      db.hostname
    ) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const paymentId = "123456789012345";
  const tokenQa = "TOKEN_FICTICIO_SEM_VALIDADE";

  let aprovados = 0;
  let chamadas = 0;

  function resposta(
    status: number,
    body: unknown
  ): Response {
    return new Response(
      JSON.stringify(body),
      {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  async function verificar(
    nome: string,
    fn: () => Promise<void>
  ) {
    await fn();
    aprovados++;
    console.log("✔", nome);
  }

  await verificar(
    "Consulta usa GET e URL de reembolsos",
    async () => {
      const fakeFetch: typeof fetch =
        async (input, init) => {
          chamadas++;

          assert.equal(
            String(input),
            `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`
          );

          assert.equal(
            init?.method,
            "GET"
          );

          assert.equal(
            new Headers(init?.headers).get(
              "Authorization"
            ),
            `Bearer ${tokenQa}`
          );

          return resposta(200, []);
        };

      const resultado =
        await consultarEstornosPagamentoMercadoPago(
          paymentId,
          {
            token: tokenQa,
            fetchImpl: fakeFetch,
          }
        );

      assert.deepEqual(resultado, []);
      assert.equal(chamadas, 1);
    }
  );

  await verificar(
    "Consulta recebe lista de estornos",
    async () => {
      const fakeFetch: typeof fetch =
        async () =>
          resposta(200, [
            {
              id: 101,
              payment_id: Number(paymentId),
              amount: 25,
              status: "approved",
              date_created:
                "2026-10-28T12:00:00Z",
            },
          ]);

      const resultado =
        await consultarEstornosPagamentoMercadoPago(
          paymentId,
          {
            token: tokenQa,
            fetchImpl: fakeFetch,
          }
        );

      assert.equal(resultado.length, 1);
      assert.equal(resultado[0].id, 101);
      assert.equal(resultado[0].amount, 25);
      assert.equal(
        resultado[0].status,
        "approved"
      );
    }
  );

  await verificar(
    "Resposta vazia continua inconclusiva",
    async () => {
      const fakeFetch: typeof fetch =
        async () => resposta(200, []);

      const resultado =
        await consultarEstornosPagamentoMercadoPago(
          paymentId,
          {
            token: tokenQa,
            fetchImpl: fakeFetch,
          }
        );

      assert.equal(resultado.length, 0);
    }
  );

  await verificar(
    "Erro HTTP do provedor e identificado",
    async () => {
      const fakeFetch: typeof fetch =
        async () =>
          resposta(503, {
            message: "Unavailable",
          });

      await assert.rejects(
        () =>
          consultarEstornosPagamentoMercadoPago(
            paymentId,
            {
              token: tokenQa,
              fetchImpl: fakeFetch,
            }
          ),
        /MP_REFUNDS_QUERY_HTTP_503/
      );
    }
  );

  await verificar(
    "Resposta invalida e rejeitada",
    async () => {
      const fakeFetch: typeof fetch =
        async () =>
          resposta(200, {
            refunds: [],
          });

      await assert.rejects(
        () =>
          consultarEstornosPagamentoMercadoPago(
            paymentId,
            {
              token: tokenQa,
              fetchImpl: fakeFetch,
            }
          ),
        /MP_REFUNDS_INVALID_RESPONSE/
      );
    }
  );

  await verificar(
    "Item invalido e rejeitado",
    async () => {
      const fakeFetch: typeof fetch =
        async () =>
          resposta(200, [
            {
              id: 101,
              amount: "25.00",
              status: "approved",
            },
          ]);

      await assert.rejects(
        () =>
          consultarEstornosPagamentoMercadoPago(
            paymentId,
            {
              token: tokenQa,
              fetchImpl: fakeFetch,
            }
          ),
        /MP_REFUNDS_INVALID_ITEM/
      );
    }
  );

  await verificar(
    "ID de pagamento invalido bloqueia consulta",
    async () => {
      let chamada = false;

      const fakeFetch: typeof fetch =
        async () => {
          chamada = true;
          throw new Error(
            "NAO_DEVERIA_CONSULTAR"
          );
        };

      await assert.rejects(
        () =>
          consultarEstornosPagamentoMercadoPago(
            "ID_INVALIDO",
            {
              token: tokenQa,
              fetchImpl: fakeFetch,
            }
          ),
        /MP_REFUNDS_PAYMENT_ID_INVALID/
      );

      assert.equal(chamada, false);
    }
  );

  await verificar(
    "Token ausente bloqueia a consulta",
    async () => {
      let chamada = false;

      const fakeFetch: typeof fetch =
        async () => {
          chamada = true;
          throw new Error(
            "NAO_DEVERIA_CONSULTAR"
          );
        };

      await assert.rejects(
        () =>
          consultarEstornosPagamentoMercadoPago(
            paymentId,
            {
              token: "",
              fetchImpl: fakeFetch,
            }
          ),
        /MP_ACCESS_TOKEN_MISSING/
      );

      assert.equal(chamada, false);
    }
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );

  console.log(
    "[QA] Nenhuma requisicao externa realizada."
  );
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});