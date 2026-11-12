
import {
  classificarConciliacaoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

import type {
  PagamentoLocalConciliacao,
  PagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

type EntradaCompensacaoEvento = {
  pagamento: PagamentoLocalConciliacao & {
    plano: string;
  };
  eventoId: string;
  statusPendencia: string;
  mp: PagamentoMercadoPago;
  possuiInscricao: boolean;
  possuiBeneficio: boolean;
};

export function avaliarCompensacaoEvento(
  entrada: EntradaCompensacaoEvento
) {
  const {
    pagamento,
    eventoId,
    statusPendencia,
    mp,
    possuiInscricao,
    possuiBeneficio,
  } = entrada;

  const classificacao =
    classificarConciliacaoMercadoPago(
      pagamento,
      mp
    );

  const resposta = (
    motivo: string,
    candidataAnalise: boolean
  ) => ({
    candidataAnalise,
    motivo,
    pagamentoId: pagamento.id,
    statusMp: String(mp.status ?? ""),
    acaoConciliacao: classificacao.acao,
    motivoConciliacao: classificacao.motivo,
    estornoAutorizado: false,
    estornoExecutado: false,
  });

  if (
    pagamento.plano !== `EVENTO:${eventoId}` ||
    pagamento.provider !== "MERCADOPAGO"
  ) {
    return resposta(
      "PAGAMENTO_OU_EVENTO_INCONSISTENTE",
      false
    );
  }

  if (
    statusPendencia !== "PENDENTE_ANALISE" &&
    statusPendencia !== "EM_ANALISE"
  ) {
    return resposta(
      "PENDENCIA_EM_OUTRO_ESTADO",
      false
    );
  }

  if (possuiInscricao || possuiBeneficio) {
    return resposta(
      "ACESSO_JA_CONCEDIDO",
      false
    );
  }

  if (
    classificacao.acao !== "APROVAR" ||
    classificacao.motivo !== "MP_APROVADO"
  ) {
    return resposta(
      `REVISAR_${classificacao.motivo}`,
      false
    );
  }

  if (
    String(mp.status).toLowerCase() !== "approved" ||
    mp.status_detail !== "accredited" ||
    pagamento.status !== "PENDENTE"
  ) {
    return resposta(
      "ESTADO_FINANCEIRO_INCOMPATIVEL",
      false
    );
  }

  return resposta(
    "CANDIDATA_A_ANALISE_DE_ESTORNO",
    true
  );
}