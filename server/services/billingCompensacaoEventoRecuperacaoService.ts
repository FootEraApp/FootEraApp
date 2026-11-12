
import { Prisma } from "@prisma/client";

type EvidenciaEstorno = {
  tipo: "ENCONTRADO" | "NAO_ENCONTRADO" | "CONSULTA_FALHOU";

  pagamentoProviderRef?: string;
  estornoId?: string;
  status?: string;
  valor?: string;
  moeda?: string;
};

type EntradaRecuperacao = {
  pagamentoId: string;
  providerRef: string;
  valorOriginal: Prisma.Decimal | string | number;
  moeda: string;

  statusCompensacao: string;
  statusTentativa: string;
  operacaoExternaExecutada: boolean;

  evidencia: EvidenciaEstorno;
};

export type DecisaoRecuperacao =
  | "ESTORNO_CONFIRMADO_PARA_REVISAO"
  | "AGUARDAR_PROVEDOR"
  | "REVISAO_MANUAL";

export function avaliarRecuperacaoCompensacaoEvento(
  entrada: EntradaRecuperacao
) {
  const resposta = (
    decisao: DecisaoRecuperacao,
    motivo: string,
    identidadeConfirmada = false
  ) => ({
    pagamentoId: entrada.pagamentoId,
    decisao,
    motivo,
    identidadeConfirmada,
    atualizarPagamento: false,
    executarNovoEstorno: false,
    estornoConfirmadoLocalmente: false,
    vinculoOperacaoComprovado: false,
  });

  if (
    entrada.statusCompensacao !==
      "AGUARDANDO_CONFIRMACAO" ||
    entrada.statusTentativa !==
      "RESULTADO_DESCONHECIDO"
  ) {
    return resposta(
      "REVISAO_MANUAL",
      "ESTADO_LOCAL_INCOMPATIVEL"
    );
  }

  if (
    entrada.evidencia.tipo === "CONSULTA_FALHOU"
  ) {
    return resposta(
      "REVISAO_MANUAL",
      "CONSULTA_PROVEDOR_FALHOU"
    );
  }

  if (
    entrada.evidencia.tipo === "NAO_ENCONTRADO"
  ) {
    return resposta(
      "REVISAO_MANUAL",
      "ESTORNO_NAO_LOCALIZADO_RESULTADO_INCONCLUSIVO"
    );
  }

  const evidencia = entrada.evidencia;

  if (
    evidencia.pagamentoProviderRef !==
      entrada.providerRef ||
    !evidencia.estornoId ||
    !evidencia.status ||
    !evidencia.valor ||
    evidencia.moeda !== entrada.moeda ||
    entrada.moeda !== "BRL"
  ) {
    return resposta(
      "REVISAO_MANUAL",
      "EVIDENCIA_INCOMPLETA_OU_DIVERGENTE"
    );
  }

  let valorConfere = false;

  try {
    valorConfere =
      new Prisma.Decimal(evidencia.valor).equals(
        new Prisma.Decimal(
          entrada.valorOriginal
        )
      );
  } catch {
    return resposta(
      "REVISAO_MANUAL",
      "VALOR_ESTORNO_INVALIDO"
    );
  }

  if (!valorConfere) {
    return resposta(
      "REVISAO_MANUAL",
      "VALOR_ESTORNO_DIVERGENTE"
    );
  }

  const status = evidencia.status
    .trim()
    .toLowerCase();

  if (status === "approved") {
    return resposta(
      "ESTORNO_CONFIRMADO_PARA_REVISAO",
      "ESTORNO_EXTERNO_CONFIRMADO",
      true
    );
  }

  if (
    status === "pending" ||
    status === "in_process"
  ) {
    return resposta(
      "AGUARDAR_PROVEDOR",
      "ESTORNO_EXTERNO_EM_PROCESSAMENTO",
      true
    );
  }

  return resposta(
    "REVISAO_MANUAL",
    "STATUS_ESTORNO_NAO_CONFIRMADO",
    true
  );
}