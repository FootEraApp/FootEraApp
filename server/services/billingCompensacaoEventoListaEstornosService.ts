
import { Prisma } from "@prisma/client";

import type {
  EstornoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

export type DecisaoListaEstornos =
  | "SEM_ESTORNOS_REVISAO"
  | "ESTORNO_TOTAL_PARA_REVISAO"
  | "ESTORNO_PARCIAL_REVISAO"
  | "AGUARDAR_PROVEDOR"
  | "REVISAO_MANUAL";

export type EntradaListaEstornos = {
  pagamentoId: string;
  providerRef: string;
  valorOriginal: Prisma.Decimal | string | number;
  moeda: string;
  estornos: EstornoMercadoPago[];
};

export function avaliarListaEstornosCompensacaoEvento(
  entrada: EntradaListaEstornos
) {
  const responder = (
    decisao: DecisaoListaEstornos,
    motivo: string,
    totalAprovado: Prisma.Decimal,
    totalPendente: Prisma.Decimal
  ) => ({
    pagamentoId: entrada.pagamentoId,
    decisao,
    motivo,
    quantidadeEstornos: entrada.estornos.length,
    totalAprovado: totalAprovado.toFixed(2),
    totalPendente: totalPendente.toFixed(2),
    executarNovoEstorno: false,
    atualizarPagamento: false,
    confirmarCompensacao: false,
  });

  const zero = new Prisma.Decimal(0);

  if (
    !/^\d+$/.test(entrada.providerRef) ||
    entrada.moeda !== "BRL" ||
    !Array.isArray(entrada.estornos)
  ) {
    return responder(
      "REVISAO_MANUAL",
      "ENTRADA_INVALIDA",
      zero,
      zero
    );
  }

  let valorOriginal: Prisma.Decimal;

  try {
    valorOriginal = new Prisma.Decimal(
      entrada.valorOriginal
    );

    if (
    !valorOriginal.isFinite() ||
    valorOriginal.lessThanOrEqualTo(0) ||
    !valorOriginal.mul(100).isInteger()
    ) {
    throw new Error("VALOR_INVALIDO");
    }
  } catch {
    return responder(
      "REVISAO_MANUAL",
      "VALOR_ORIGINAL_INVALIDO",
      zero,
      zero
    );
  }

  if (entrada.estornos.length === 0) {
    return responder(
      "SEM_ESTORNOS_REVISAO",
      "LISTA_VAZIA_NAO_COMPROVA_AUSENCIA_DE_ESTORNO",
      zero,
      zero
    );
  }

  const ids = new Set<string>();
  let totalAprovado = zero;
  let totalPendente = zero;
  let possuiStatusDesconhecido = false;

  for (const estorno of entrada.estornos) {
    const id =
      estorno.id == null
        ? ""
        : String(estorno.id).trim();

    const paymentId =
      estorno.payment_id == null
        ? ""
        : String(estorno.payment_id).trim();

    if (
      !/^\d+$/.test(id) ||
      ids.has(id) ||
      paymentId !== entrada.providerRef
    ) {
      return responder(
        "REVISAO_MANUAL",
        "IDENTIDADE_DO_ESTORNO_INVALIDA",
        totalAprovado,
        totalPendente
      );
    }

    ids.add(id);

    if (
      typeof estorno.amount !== "number" ||
      !Number.isFinite(estorno.amount)
    ) {
      return responder(
        "REVISAO_MANUAL",
        "VALOR_ESTORNO_INVALIDO",
        totalAprovado,
        totalPendente
      );
    }

    const valor = new Prisma.Decimal(
      estorno.amount
    );

    if (
      !valor.isFinite() ||
      valor.lessThanOrEqualTo(0) ||
      !valor.mul(100).isInteger()
    ) {
      return responder(
        "REVISAO_MANUAL",
        "VALOR_ESTORNO_INVALIDO",
        totalAprovado,
        totalPendente
      );
    }

    const status = String(
      estorno.status ?? ""
    ).trim().toLowerCase();

    if (status === "approved") {
      totalAprovado = totalAprovado.plus(valor);
    } else if (
      status === "pending" ||
      status === "in_process"
    ) {
      totalPendente = totalPendente.plus(valor);
    } else {
      possuiStatusDesconhecido = true;
    }
  }

  if (possuiStatusDesconhecido) {
    return responder(
      "REVISAO_MANUAL",
      "STATUS_ESTORNO_NAO_CONFIRMADO",
      totalAprovado,
      totalPendente
    );
  }

  if (
    totalAprovado.plus(totalPendente)
      .greaterThan(valorOriginal)
  ) {
    return responder(
      "REVISAO_MANUAL",
      "TOTAL_ESTORNOS_EXCEDE_PAGAMENTO",
      totalAprovado,
      totalPendente
    );
  }

  if (totalPendente.greaterThan(0)) {
    return responder(
      "AGUARDAR_PROVEDOR",
      "EXISTEM_ESTORNOS_EM_PROCESSAMENTO",
      totalAprovado,
      totalPendente
    );
  }

  if (totalAprovado.equals(valorOriginal)) {
    return responder(
      "ESTORNO_TOTAL_PARA_REVISAO",
      "VALOR_TOTAL_APROVADO_NA_LISTA",
      totalAprovado,
      totalPendente
    );
  }

  if (totalAprovado.greaterThan(0)) {
    return responder(
      "ESTORNO_PARCIAL_REVISAO",
      "VALOR_DEVOLVIDO_INFERIOR_AO_PAGAMENTO",
      totalAprovado,
      totalPendente
    );
  }

  return responder(
    "REVISAO_MANUAL",
    "SEM_CONFIRMACAO_DE_ESTORNO",
    totalAprovado,
    totalPendente
  );
}