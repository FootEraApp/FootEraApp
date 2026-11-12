
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import {
  validarPixRecuperavelMercadoPago,
  type PagamentoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

const pagamentoId =
  "11111111-1111-4111-8111-111111111111";

const providerRef = "123456789";

const qr = "PIX_FICTICIO_QA";

const agora =
  new Date("2026-10-29T15:00:00.000Z");

const mpValido: PagamentoMercadoPago = {
  id: providerRef,
  status: "pending",
  transaction_amount: 19.9,
  currency_id: "BRL",
  external_reference: pagamentoId,
  metadata: {
    pagamentoId,
  },
  date_of_expiration:
    "2026-10-30T15:00:00.000Z",
  point_of_interaction: {
    transaction_data: {
      qr_code: qr,
    },
  },
};

function validar(
  mp: PagamentoMercadoPago
): boolean {
  return validarPixRecuperavelMercadoPago({
    pagamentoId,
    providerRef,
    valor: new Prisma.Decimal("19.90"),
    moeda: "BRL",
    pixCopiaECola: qr,
    mp,
    agora,
  });
}

async function main() {
  let aprovados = 0;

  function conferir(
    descricao: string,
    resultado: boolean,
    esperado: boolean
  ) {
    assert.equal(resultado, esperado);
    aprovados++;
    console.log("✔", descricao);
  }

  conferir(
    "PIX pendente valido",
    validar(mpValido),
    true
  );

  conferir(
    "Pagamento aprovado nao reutiliza PIX",
    validar({
      ...mpValido,
      status: "approved",
    }),
    false
  );

  conferir(
    "Pagamento cancelado nao reutiliza PIX",
    validar({
      ...mpValido,
      status: "cancelled",
    }),
    false
  );

  conferir(
    "Valor divergente bloqueado",
    validar({
      ...mpValido,
      transaction_amount: 29.9,
    }),
    false
  );

  conferir(
    "Identidade divergente bloqueada",
    validar({
      ...mpValido,
      external_reference: "outro-pagamento",
    }),
    false
  );

  conferir(
    "QR divergente bloqueado",
    validar({
      ...mpValido,
      point_of_interaction: {
        transaction_data: {
          qr_code: "OUTRO_PIX",
        },
      },
    }),
    false
  );

  conferir(
    "PIX expirado bloqueado",
    validar({
      ...mpValido,
      date_of_expiration:
        "2026-10-28T15:00:00.000Z",
    }),
    false
  );

  conferir(
    "PIX sem QR externo exige conciliacao",
    validar({
      ...mpValido,
      point_of_interaction: null,
    }),
    false
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );
}

main().catch((erro) => {
  console.error("QA_PIX_FALHOU:", erro);
  process.exitCode = 1;
});