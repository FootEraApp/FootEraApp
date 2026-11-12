
import type {
  PagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

type ConsultorPagamento = (
  paymentId: string
) => Promise<PagamentoMercadoPago>;

let consultorQa: ConsultorPagamento | null = null;

function ambienteQaSeguro(): boolean {
  if (process.env.NODE_ENV !== "test") {
    return false;
    }

  if (process.env.MP_ACCESS_TOKEN) {
    return false;
  }

  if (
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false"
    ) {
    return false;
    }

  try {
    const db = new URL(
      process.env.DATABASE_URL ?? ""
    );

    return (
    db.protocol === "postgresql:" &&
    ["127.0.0.1", "localhost"].includes(db.hostname) &&
    db.port === "5433" &&
    db.pathname === "/footera_billing_qa"
    );
  } catch {
    return false;
  }
}

// Só pode ser usado pelo processo de testes QA.
// A proteção é verificada tanto na instalação
// quanto na execução do mock.
export function configurarConsultorMercadoPagoQa(
  consultor: ConsultorPagamento | null
): void {
  if (!ambienteQaSeguro()) {
    throw new Error(
      "BILLING_MP_MOCK_QA_DISABLED"
    );
  }

  consultorQa = consultor;
}

export async function obterPagamentoMercadoPago(
  paymentId: string,
  consultaReal: ConsultorPagamento
): Promise<PagamentoMercadoPago> {
  if (!/^\d+$/.test(paymentId)) {
    throw new Error("MP_PAYMENT_ID_INVALID");
  }

  if (consultorQa !== null) {
    if (!ambienteQaSeguro()) {
      throw new Error(
        "BILLING_MP_MOCK_QA_DISABLED"
      );
    }

    return consultorQa(paymentId);
  }
  // Ambiente QA: nunca fazer fallback para
  // uma consulta externa quando o mock faltar.
  if (
    process.env.BILLING_CUPOM_RESERVA_QA === "true"
  ) {
    throw new Error(
      "BILLING_MP_QA_CONSULTOR_NAO_CONFIGURADO"
    );
  }

  return consultaReal(paymentId);
}

export type EvidenciaEstornoQa =
  | {
      tipo: "ENCONTRADO";
      pagamentoProviderRef: string;
      estornoId: string;
      status: string;
      valor: string;
      moeda: string;
    }
  | { tipo: "NAO_ENCONTRADO" }
  | { tipo: "CONSULTA_FALHOU" };

type ConsultorEstornoQa = (
  paymentId: string
) => Promise<EvidenciaEstornoQa>;

let consultorEstornoQa: ConsultorEstornoQa | null = null;

/**
 * Instala um simulador de consulta de estorno.
 * Não habilita nenhum endpoint real.
 */
export function configurarConsultorEstornoQa(
  consultor: ConsultorEstornoQa | null
): void {
  if (!ambienteQaSeguro()) {
    throw new Error(
      "BILLING_ESTORNO_MOCK_QA_DISABLED"
    );
  }

  consultorEstornoQa = consultor;
}

/**
 * Consulta exclusivamente o simulador QA.
 * Nunca executa reembolso.
 */
export async function obterEvidenciaEstornoQa(
  paymentId: string
): Promise<EvidenciaEstornoQa> {
  if (!ambienteQaSeguro()) {
    throw new Error(
      "BILLING_ESTORNO_CONSULTA_QA_DISABLED"
    );
  }

  if (!/^\d+$/.test(paymentId)) {
    throw new Error("MP_PAYMENT_ID_INVALID");
  }

  if (!consultorEstornoQa) {
    throw new Error(
      "BILLING_ESTORNO_CONSULTOR_QA_NOT_CONFIGURED"
    );
  }

  return consultorEstornoQa(paymentId);
}