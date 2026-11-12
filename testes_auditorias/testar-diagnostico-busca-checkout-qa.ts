
import assert from "node:assert/strict";
import {
  diagnosticarBuscaCheckoutSemReferencia,
  type PagamentoLocalConciliacao,
  type PagamentoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

const local: PagamentoLocalConciliacao = {
  id: "12345678-1234-1234-1234-123456789012",
  provider: "MERCADOPAGO",
  providerRef: null,
  valor: "19.90",
  moeda: "BRL",
  status: "PENDENTE",
};

const aprovado: PagamentoMercadoPago = {
  id: 987654321,
  external_reference: local.id,
  metadata: { pagamentoId: local.id },
  status: "approved",
  status_detail: "accredited",
  transaction_amount: 19.9,
  currency_id: "BRL",
};

async function main() {
  let consultas = 0;

  const encontrado =
    await diagnosticarBuscaCheckoutSemReferencia(
      local,
      async (pagamentoId) => {
        consultas++;
        assert.equal(pagamentoId, local.id);
        return aprovado;
      }
    );

  assert.equal(encontrado.consultada, true);
  assert.equal(encontrado.acao, "APROVAR");
  assert.equal(encontrado.motivo, "MP_APROVADO");

  console.log("✔ Pagamento válido classificado");

  const ausente =
    await diagnosticarBuscaCheckoutSemReferencia(
      local,
      async () => {
        consultas++;
        return null;
      }
    );

  assert.equal(
    ausente.motivo,
    "PAGAMENTO_NAO_LOCALIZADO_NA_BUSCA"
  );

  console.log("✔ Pagamento ausente exige revisão");

  const divergente =
    await diagnosticarBuscaCheckoutSemReferencia(
      local,
      async () => {
        consultas++;
        return {
          ...aprovado,
          external_reference: "OUTRO_PAGAMENTO",
        };
      }
    );

  assert.equal(
    divergente.acao,
    "CONCILIACAO_MANUAL"
  );

  assert.equal(
    divergente.motivo,
    "IDENTIDADE_NAO_COMPROVADA"
  );

  console.log("✔ Identidade divergente bloqueada");

  const erro =
    await diagnosticarBuscaCheckoutSemReferencia(
      local,
      async () => {
        consultas++;
        throw new Error("MP_SEARCH_AMBIGUOUS");
      }
    );

  assert.equal(
    erro.motivo,
    "BUSCA_EXTERNA_INDISPONIVEL"
  );

  console.log("✔ Busca ambígua exige revisão");

  const antes = consultas;

  const incompatível =
    await diagnosticarBuscaCheckoutSemReferencia(
      {
        ...local,
        provider: "INTERNAL_FAKE",
      },
      async () => {
        throw new Error(
          "ESTA_CONSULTA_NAO_DEVERIA_EXECUTAR"
        );
      }
    );

  assert.equal(
    incompatível.motivo,
    "ESTADO_FINANCEIRO_INCOMPATIVEL"
  );

  assert.equal(consultas, antes);

  console.log("✔ Provedor incompatível não consulta");

  const referenciaExistente =
    await diagnosticarBuscaCheckoutSemReferencia(
      {
        ...local,
        providerRef: "123456789",
      },
      async () => {
        throw new Error(
          "ESTA_CONSULTA_NAO_DEVERIA_EXECUTAR"
        );
      }
    );

  assert.equal(
    referenciaExistente.motivo,
    "REFERENCIA_EXTERNA_JA_EXISTE"
  );

  console.log("✔ Referência já existente bloqueada");

  assert.equal(consultas, 4);

  console.log("\nRESULTADO: 6/6");
}

main().catch((erro) => {
  console.error(
    "QA_DIAGNOSTICO_BUSCA_FALHOU:",
    erro
  );
  process.exitCode = 1;
});