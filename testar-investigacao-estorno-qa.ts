
import assert from "node:assert/strict";

async function main() {
  const db = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const {
    classificarEstornosParaInvestigacao,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  let testes = 0;

  function ok(nome: string) {
    testes++;
    console.log("✔", nome);
  }

  const pagamento = "123456789";
  const valor = "25.00";

  const aprovado = {
    id: "99887766",
    payment_id: pagamento,
    amount: 25,
    status: "approved",
    date_created: "2026-10-30T12:00:00Z",
  };

  const nenhum =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      []
    );

  assert.equal(nenhum.quantidadeCandidatos, 0);
  assert.equal(nenhum.podeReenviar, false);

  ok("Nenhum estorno nao permite reenvio");

  const um =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [aprovado]
    );

  assert.equal(um.quantidadeCandidatos, 1);

  assert.equal(
    um.podeFinalizarAutomaticamente,
    false
  );

  assert.equal(
    um.situacao,
    "CANDIDATOS_EXIGEM_REVISAO"
  );

  ok("Um candidato exige revisao");

  const varios =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [
        aprovado,
        {
          ...aprovado,
          id: "99887767",
        },
      ]
    );

  assert.equal(varios.quantidadeCandidatos, 2);
  assert.equal(
    varios.podeFinalizarAutomaticamente,
    false
  );

  ok("Multiplos candidatos nao sao associados");

  const outroPagamento =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [
        {
          ...aprovado,
          payment_id: "987654321",
        },
      ]
    );

  assert.equal(
    outroPagamento.quantidadeCandidatos,
    0
  );

  ok("Pagamento divergente rejeitado");

  const valorDiferente =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [
        {
          ...aprovado,
          amount: 20,
        },
      ]
    );

  assert.equal(
    valorDiferente.quantidadeCandidatos,
    0
  );

  ok("Valor divergente rejeitado");

  const pendente =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [
        {
          ...aprovado,
          status: "pending",
        },
      ]
    );

  assert.equal(pendente.quantidadeCandidatos, 0);

  ok("Estorno nao aprovado rejeitado");

  const invalido =
    classificarEstornosParaInvestigacao(
      pagamento,
      valor,
      [
        {
          ...aprovado,
          amount: "valor-invalido",
        },
      ]
    );

  assert.equal(invalido.quantidadeCandidatos, 0);

  ok("Valor externo malformado rejeitado");

  await assert.rejects(
    async () =>
      classificarEstornosParaInvestigacao(
        "pagamento-invalido",
        valor,
        [aprovado]
      ),
    /BILLING_INVESTIGACAO_PAGAMENTO_INVALIDO/
  );

  ok("Identidade de pagamento invalida bloqueada");

  console.log(`\nRESULTADO: ${testes}/8`);
}

main().catch((erro) => {
  console.error(
    "QA_INVESTIGACAO_ESTORNO_FALHOU:",
    erro
  );
  process.exitCode = 1;
});