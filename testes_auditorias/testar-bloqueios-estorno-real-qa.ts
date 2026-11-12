
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      db.hostname
    ) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const {
    adquirirExecucaoEnvioEstornoReal,
    registrarResultadoEnvioEstornoReal,
    conciliarEstornoReal,
    consultarRetomadaEstornoReal,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const {
    solicitarEstornoMercadoPago,
  } = await import(
    "./server/services/billingEstornoMercadoPagoGateway.js"
  );

  const pagamentoId = randomUUID();

  let verificacoes = 0;

  function ok(nome: string) {
    verificacoes++;
    console.log("✔", nome);
  }

  await assert.rejects(
    adquirirExecucaoEnvioEstornoReal(pagamentoId),
    /BILLING_ESTORNO_REAL_DESABILITADO/
  );

  ok("Aquisicao real bloqueada em QA");

  await assert.rejects(
    registrarResultadoEnvioEstornoReal(
      pagamentoId,
      "123456789"
    ),
    /BILLING_CONSULTA_ESTORNO_REAL_INDISPONIVEL/
  );

  ok("Registro de resultado real bloqueado em QA");

  await assert.rejects(
    conciliarEstornoReal(pagamentoId),
    /BILLING_CONSULTA_ESTORNO_REAL_INDISPONIVEL/
  );

  ok("Conciliacao real bloqueada em QA");

  await assert.rejects(
    consultarRetomadaEstornoReal(pagamentoId),
    /BILLING_CONSULTA_ESTORNO_REAL_INDISPONIVEL/
  );

  ok("Consulta real bloqueada em QA");

  await assert.rejects(
    solicitarEstornoMercadoPago(),
    /BILLING_ESTORNO_ENVIO_REAL_DESABILITADO/
  );

  ok("POST real permanece desabilitado");

  console.log(
    `\nRESULTADO: ${verificacoes}/5`
  );
}

main().catch((erro) => {
  console.error(
    "QA_BLOQUEIOS_ESTORNO_FALHOU:",
    erro
  );

  process.exitCode = 1;
});