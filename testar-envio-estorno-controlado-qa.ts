import assert from "node:assert/strict";
import {
  consultarEstornosPagamentoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";
import {
  solicitarEstornoMercadoPago,
} from "./server/services/billingEstornoMercadoPagoGateway.js";

async function main() {
  let total = 0;
  let get = 0;
  let post = 0;
  const paymentId = "123456789";
  const resposta = (status: number, dados: unknown): typeof fetch =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      if (metodo === "POST") post++;
      if (metodo === "GET") get++;
      assert.equal(metodo, "GET");
      assert.equal(String(url), `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`);
      return new Response(JSON.stringify(dados), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  const consultar = (status: number, dados: unknown) =>
    consultarEstornosPagamentoMercadoPago(paymentId, {
      token: "TOKEN_QA_FICTICIO",
      fetchImpl: resposta(status, dados),
    });
  const ok = (nome: string) => { total++; console.log("✔", nome); };

  await assert.rejects(solicitarEstornoMercadoPago(), /BILLING_ESTORNO_ENVIO_REAL_DESABILITADO/);
  ok("Envio real continua desabilitado");
  const lista = await consultar(200, [{ id: 456, payment_id: 123456789, status: "approved", amount: 25 }]);
  assert.equal(lista.length, 1);
  assert.equal(String(lista[0].payment_id), paymentId);
  ok("GET simulado identifica estorno existente");
  const vazia = await consultar(200, []);
  assert.equal(vazia.length, 0);
  ok("Estorno ausente não é inventado");
  await assert.rejects(consultar(502, {}), /MP_REFUNDS_QUERY_HTTP_502/);
  ok("Erro HTTP não é interpretado como estorno ausente");
  await assert.rejects(consultar(200, { id: 456 }), /MP_REFUNDS_INVALID_RESPONSE/);
  ok("Resposta inválida é recusada");
  await assert.rejects(consultar(200, [{ id: 456, status: "approved", amount: -1 }]), /MP_REFUNDS_INVALID_ITEM/);
  ok("Valor externo inválido é recusado");
  assert.equal(post, 0);
  assert.equal(get, 5);
  ok("Nenhuma requisição POST realizada");
  console.log(`\nRESULTADO: ${total}/7`);
}

main().catch((erro) => { console.error("QA_ESTORNO_CONTROLADO_FALHOU:", erro); process.exitCode = 1; });
