
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(
    process.env.ENABLE_EVENT_REFUNDS_REAL,
    "false"
  );
  assert.notEqual(
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED,
    "true"
  );
  assert.equal(
    process.env.BILLING_CUPOM_RESERVA_QA,
    "true"
  );
  assert.equal(db.hostname === "localhost" ||
    db.hostname === "127.0.0.1", true);
  assert.equal(db.port, "5433");
  assert.equal(db.pathname, "/footera_billing_qa");

  const { executarEstornoRealControlado } =
    await import(
      "./server/services/billingCompensacaoEventoEnvioService.js"
    );

  const {
    executarPostEstornoAutorizadoMercadoPago,
  } = await import(
    "./server/services/billingEstornoMercadoPagoGateway.js"
  );

  await assert.rejects(
    executarEstornoRealControlado(randomUUID()),
    /BILLING_ESTORNO_REAL_DESABILITADO/
  );

  console.log(
    "✔ Orquestrador real bloqueado em QA"
  );
    
    const pagamentoIdQa = randomUUID();
    const tentativaIdQa = randomUUID();

    await assert.rejects(
    executarPostEstornoAutorizadoMercadoPago({
        pagamentoId: pagamentoIdQa,
        tentativaId: tentativaIdQa,
        pagamentoProviderRef: "123456789",
        chaveIdempotencia:
        `footera-evento-refund-${pagamentoIdQa}`,
        valorEsperadoCentavos: 2500,
    }),
    /BILLING_POST_ESTORNO_REAL_BLOQUEADO/
    );

  console.log(
    "✔ Transporte real bloqueado em QA"
  );

  console.log(
    "✔ Nenhum POST real executado"
  );

  console.log("\nRESULTADO: 3/3");
}

main().catch((erro) => {
  console.error("QA_ORQUESTRADOR_FALHOU:", erro);
  process.exitCode = 1;
});