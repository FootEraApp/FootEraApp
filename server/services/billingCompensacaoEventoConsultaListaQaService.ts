
import type { Prisma } from "@prisma/client";

import {
  consultarEstornosPagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

import {
  avaliarListaEstornosCompensacaoEvento,
} from "./billingCompensacaoEventoListaEstornosService.js";

type Entrada = {
  pagamentoId: string;
  providerRef: string;
  valorOriginal: Prisma.Decimal | string | number;
  moeda: string;

  // Obrigatório: transporte HTTP simulado.
  fetchQa: typeof fetch;
};

function validarAmbienteQa(): void {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_CONSULTA_LISTA_QA_DISABLED"
    );
  }
}

/**
 * Integra a leitura HTTP simulada com a
 * avaliação da lista de estornos.
 *
 * Não altera o banco.
 * Não executa reembolso.
 * Não confirma compensação.
 */
export async function consultarEAnalisarListaEstornosQa(
  entrada: Entrada
) {
  validarAmbienteQa();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      entrada.pagamentoId
    ) ||
    !/^\d+$/.test(entrada.providerRef) ||
    typeof entrada.fetchQa !== "function"
  ) {
    throw new Error(
      "BILLING_CONSULTA_LISTA_ENTRADA_INVALIDA"
    );
  }

  try {
    // O token é fictício e o transporte
    // precisa ser fornecido pelo teste.
    const estornos =
      await consultarEstornosPagamentoMercadoPago(
        entrada.providerRef,
        {
          token: "TOKEN_FICTICIO_QA",
          fetchImpl: entrada.fetchQa,
        }
      );

    const avaliacao =
      avaliarListaEstornosCompensacaoEvento({
        pagamentoId: entrada.pagamentoId,
        providerRef: entrada.providerRef,
        valorOriginal: entrada.valorOriginal,
        moeda: entrada.moeda,
        estornos,
      });

    return {
      consultaConcluida: true,
      quantidadeRetornada: estornos.length,
      avaliacao,
      executarNovoEstorno: false,
      atualizarPagamento: false,
    };
  } catch {
    // Uma falha de consulta não equivale
    // a uma lista de reembolsos vazia.
    return {
      consultaConcluida: false,
      quantidadeRetornada: null,
      avaliacao: {
        pagamentoId: entrada.pagamentoId,
        decisao: "REVISAO_MANUAL" as const,
        motivo: "CONSULTA_LISTA_ESTORNOS_FALHOU",
        quantidadeEstornos: 0,
        totalAprovado: "0.00",
        totalPendente: "0.00",
        executarNovoEstorno: false,
        atualizarPagamento: false,
        confirmarCompensacao: false,
      },
      executarNovoEstorno: false,
      atualizarPagamento: false,
    };
  }
}