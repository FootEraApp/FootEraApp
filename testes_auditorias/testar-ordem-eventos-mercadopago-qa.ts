
import assert from "node:assert/strict";

import {
  classificarConciliacaoMercadoPago,
  type PagamentoLocalConciliacao,
  type PagamentoMercadoPago,
  type AcaoConciliacao,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

// Testes offline: nenhuma cobrança ou alteração no banco.

const pagamentoBase: PagamentoLocalConciliacao = {
  id: "qa-pagamento-123",
  provider: "MERCADOPAGO",
  providerRef: "PREF-QA-123",
  valor: "25.00",
  moeda: "BRL",
  status: "PENDENTE",
};

const retornoBase: PagamentoMercadoPago = {
  id: "123456789",
  status: "approved",
  status_detail: "accredited",
  external_reference: pagamentoBase.id,
  metadata: {
    pagamentoId: pagamentoBase.id,
  },
  currency_id: "BRL",
  transaction_amount: 25,
};

let aprovados = 0;
let falhas = 0;

function verificar(
  titulo: string,
  estadoLocal: string,
  estadoMp: string,
  esperado: AcaoConciliacao,
  alteracoes: Partial<PagamentoMercadoPago> = {}
) {
  const resultado = classificarConciliacaoMercadoPago(
    {
      ...pagamentoBase,
      status: estadoLocal,
    },
    {
      ...retornoBase,
      status: estadoMp,
      ...alteracoes,
    }
  );

  try {
    assert.equal(resultado.acao, esperado);
    aprovados++;

    console.log(
      `✔ ${titulo} — ${resultado.acao}`
    );
  } catch (erro) {
    falhas++;

    console.error(
      `✖ ${titulo}`,
      {
        esperado,
        recebido: resultado.acao,
        motivo: resultado.motivo,
      }
    );
  }
}

// Pagamento ainda em processamento.
verificar(
  "Pendente nao concede acesso",
  "PENDENTE",
  "pending",
  "AGUARDAR"
);

verificar(
  "Em processamento nao concede acesso",
  "PENDENTE",
  "in_process",
  "AGUARDAR"
);

// Confirmacao normal.
verificar(
  "Aprovacao valida",
  "PENDENTE",
  "approved",
  "APROVAR"
);

// Webhook repetido.
verificar(
  "Aprovacao duplicada",
  "APROVADO",
  "approved",
  "JA_CONCILIADO"
);

// Eventos atrasados.
verificar(
  "Aprovacao apos cancelamento",
  "CANCELADO",
  "approved",
  "CONCILIACAO_MANUAL"
);

verificar(
  "Aprovacao apos falha",
  "FALHOU",
  "approved",
  "CONCILIACAO_MANUAL"
);

verificar(
  "Cancelamento enquanto pendente",
  "PENDENTE",
  "cancelled",
  "CANCELAR_PENDENTE"
);

verificar(
  "Cancelamento repetido",
  "CANCELADO",
  "cancelled",
  "JA_CONCILIADO"
);

verificar(
  "Cancelamento apos aprovacao",
  "APROVADO",
  "cancelled",
  "CONCILIACAO_MANUAL"
);

verificar(
  "Rejeicao apos aprovacao",
  "APROVADO",
  "rejected",
  "CONCILIACAO_MANUAL"
);

// Reversoes financeiras.
verificar(
  "Reembolso completo exige conciliacao",
  "APROVADO",
  "refunded",
  "CONCILIACAO_MANUAL"
);

verificar(
  "Chargeback exige conciliacao",
  "APROVADO",
  "charged_back",
  "CONCILIACAO_MANUAL"
);

verificar(
  "Reembolso parcial exige conciliacao",
  "APROVADO",
  "approved",
  "CONCILIACAO_MANUAL",
  { status_detail: "partially_refunded" }
);

// Dados do provedor divergentes.
verificar(
  "Valor divergente impede aprovacao",
  "PENDENTE",
  "approved",
  "CONCILIACAO_MANUAL",
  { transaction_amount: 30 }
);

verificar(
  "Moeda divergente impede aprovacao",
  "PENDENTE",
  "approved",
  "CONCILIACAO_MANUAL",
  { currency_id: "USD" }
);

verificar(
  "ID interno divergente impede aprovacao",
  "PENDENTE",
  "approved",
  "CONCILIACAO_MANUAL",
  { external_reference: "outro-pagamento" }
);

console.log(
  `\nRESULTADO: ${aprovados}/${aprovados + falhas}`
);

if (falhas > 0) {
  process.exitCode = 1;
}