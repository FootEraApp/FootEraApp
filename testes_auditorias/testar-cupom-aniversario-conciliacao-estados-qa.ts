
import assert from "node:assert/strict";
import {
  classificarConciliacaoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

const id = "11111111-1111-4111-8111-111111111111";
const ref = "123456789012345";

const local = {
  id,
  provider: "MERCADOPAGO",
  providerRef: ref,
  valor: "40.00",
  moeda: "BRL",
  status: "PENDENTE",
};

const mp = {
  id: ref,
  status: "approved",
  status_detail: "accredited",
  transaction_amount: 40,
  currency_id: "BRL",
  external_reference: id,
  metadata: { pagamentoId: id },
};

let testes = 0;

function testar(
  nome: string,
  esperado: string,
  alteracoes: Record<string, unknown> = {},
  alteracoesLocal: Record<string, unknown> = {}
) {
  const resultado = classificarConciliacaoMercadoPago(
    { ...local, ...alteracoesLocal },
    { ...mp, ...alteracoes }
  );

  assert.equal(
    resultado.acao,
    esperado,
    `${nome}: ${resultado.motivo}`
  );

  console.log(`APROVADO ${++testes} — ${nome}`);
}

testar("Aprovação válida", "APROVAR");

testar(
  "PIX pendente",
  "AGUARDAR",
  { status: "pending" }
);

testar(
  "Pagamento em processamento",
  "AGUARDAR",
  { status: "in_process" }
);

testar(
  "Pagamento cancelado",
  "CANCELAR_PENDENTE",
  { status: "cancelled" }
);

testar(
  "Pagamento recusado",
  "CANCELAR_PENDENTE",
  { status: "rejected" }
);

testar(
  "Valor divergente",
  "CONCILIACAO_MANUAL",
  { transaction_amount: 39 }
);

testar(
  "Moeda divergente",
  "CONCILIACAO_MANUAL",
  { currency_id: "USD" }
);

testar(
  "Identidade divergente",
  "CONCILIACAO_MANUAL",
  { external_reference: "outro-pagamento" }
);

testar(
  "Reembolso",
  "CONCILIACAO_MANUAL",
  { status: "refunded" }
);

testar(
  "Chargeback",
  "CONCILIACAO_MANUAL",
  { status: "charged_back" }
);

testar(
  "Pagamento já aprovado",
  "JA_CONCILIADO",
  {},
  { status: "APROVADO" }
);

testar(
  "Aprovação tardia após cancelamento",
  "CONCILIACAO_MANUAL",
  {},
  { status: "CANCELADO" }
);

console.log(
  `RESULTADO: ${testes}/${testes} verificações aprovadas.`
);