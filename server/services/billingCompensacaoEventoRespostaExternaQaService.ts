
import { Prisma } from "@prisma/client";

type RespostaEstorno = {
  id?: string | number;
  payment_id?: string | number;
  amount?: number;
  status?: string;
};

export type EntradaRespostaExternaQa = {
  pagamentoId: string;
  providerRef: string;
  chaveEsperada: string;
  chaveUtilizada: string;
  valorOriginal: Prisma.Decimal | string | number;

  resultado:
    | "SEM_RESPOSTA"
    | "ERRO_HTTP"
    | "RESPOSTA";

  httpStatus?: number;
  resposta?: RespostaEstorno | null;
};

export function avaliarRespostaExternaEstornoQa(
  entrada: EntradaRespostaExternaQa
) {
  const responder = (
    motivo: string,
    evidenciaCompativel = false
  ) => ({
    pagamentoId: entrada.pagamentoId,
    motivo,
    evidenciaCompativel,
    exigeRevisao: true,
    executarNovoEstorno: false,
    repetirRequisicao: false,
    atualizarPagamento: false,
    confirmarCompensacao: false,
    gravarEstornoProviderRef: false,
  });

  if (
    !/^\d+$/.test(entrada.providerRef) ||
    entrada.chaveEsperada !==
      `footera-evento-refund-${entrada.pagamentoId}` ||
    entrada.chaveUtilizada !== entrada.chaveEsperada
  ) {
    return responder(
      "CHAVE_OU_REFERENCIA_INCONSISTENTE"
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
    return responder("VALOR_ORIGINAL_INVALIDO");
  }

  if (entrada.resultado === "SEM_RESPOSTA") {
    return responder(
      "RESULTADO_EXTERNO_DESCONHECIDO"
    );
  }

  if (entrada.resultado === "ERRO_HTTP") {
    return responder(
      "ERRO_HTTP_RESULTADO_INCONCLUSIVO"
    );
  }

  if (entrada.resultado !== "RESPOSTA") {
    return responder("TIPO_RESULTADO_INVALIDO");
  }

  const resposta = entrada.resposta;

  if (
    !resposta ||
    typeof resposta !== "object" ||
    Array.isArray(resposta)
  ) {
    return responder("RESPOSTA_EXTERNA_INVALIDA");
  }

  const refundId =
    resposta.id == null
      ? ""
      : String(resposta.id).trim();

  const paymentId =
    resposta.payment_id == null
      ? ""
      : String(resposta.payment_id).trim();

  if (
    !/^\d+$/.test(refundId) ||
    paymentId !== entrada.providerRef
  ) {
    return responder(
      "IDENTIDADE_EXTERNA_NAO_COMPROVADA"
    );
  }

  if (
    typeof resposta.amount !== "number" ||
    !Number.isFinite(resposta.amount)
  ) {
    return responder("VALOR_EXTERNO_INVALIDO");
  }

  const valorExterno = new Prisma.Decimal(
    resposta.amount
  );

  if (
    valorExterno.lessThanOrEqualTo(0) ||
    !valorExterno.mul(100).isInteger()
  ) {
    return responder("VALOR_EXTERNO_INVALIDO");
  }

  if (valorExterno.greaterThan(valorOriginal)) {
    return responder("VALOR_EXTERNO_EXCEDENTE");
  }

  if (valorExterno.lessThan(valorOriginal)) {
    return responder("ESTORNO_PARCIAL_REVISAO");
  }

  const status = String(
    resposta.status ?? ""
  ).trim().toLowerCase();

  if (
    status === "pending" ||
    status === "in_process"
  ) {
    return responder(
      "ESTORNO_AINDA_EM_PROCESSAMENTO"
    );
  }

  if (status !== "approved") {
    return responder(
      "STATUS_EXTERNO_NAO_CONFIRMADO"
    );
  }

  return responder(
    "RESPOSTA_COMPATIVEL_EXIGE_REVISAO",
    true
  );
}