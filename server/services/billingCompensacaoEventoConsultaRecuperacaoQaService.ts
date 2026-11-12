
import { prisma } from "../prisma.js";

import {
  obterEvidenciaEstornoQa,
  type EvidenciaEstornoQa,
} from "./billingMercadoPagoGateway.js";

import {
  avaliarRecuperacaoCompensacaoEvento,
} from "./billingCompensacaoEventoRecuperacaoService.js";

export async function consultarRecuperacaoCompensacaoQa(
  pagamentoId: string
) {
  const id = String(pagamentoId ?? "").trim();

  const db = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
    );

    if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
    ) {
    throw new Error("QA_RECUPERACAO_AMBIENTE_INSEGURO");
    }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new Error(
      "QA_RECUPERACAO_PAGAMENTO_ID_INVALIDO"
    );
  }

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId: id },
      include: {
        pagamento: true,
        pendencia: true,
        historicoTentativas: {
          orderBy: { numero: "desc" },
          take: 1,
        },
      },
    });

  if (!compensacao) {
    throw new Error(
      "QA_RECUPERACAO_COMPENSACAO_NAO_ENCONTRADA"
    );
  }

  const pagamento = compensacao.pagamento;
  const pendencia = compensacao.pendencia;
  const tentativa =
    compensacao.historicoTentativas[0];

  if (
    !tentativa ||
    pagamento.provider !== "MERCADOPAGO" ||
    pagamento.status !== "PENDENTE" ||
    pagamento.plano !==
      `EVENTO:${pendencia.eventoId}` ||
    pendencia.pagamentoId !== pagamento.id ||
    pagamento.providerRef !==
      compensacao.providerRef ||
    compensacao.providerRef !==
      pendencia.providerRef ||
    !pagamento.valor.equals(compensacao.valor) ||
    compensacao.moeda !== "BRL" ||
    pagamento.moeda !== compensacao.moeda ||
    compensacao.status !==
      "AGUARDANDO_CONFIRMACAO" ||
    tentativa.status !== "RESULTADO_DESCONHECIDO" ||
    tentativa.ambiente !== "QA" ||
    tentativa.operacaoExternaExecutada !== false
  ) {
    throw new Error(
      "QA_RECUPERACAO_ESTADO_INCOMPATIVEL"
    );
  }

  let evidencia: EvidenciaEstornoQa;

  try {
    evidencia = await obterEvidenciaEstornoQa(
      compensacao.providerRef
    );
  } catch {
    evidencia = {
      tipo: "CONSULTA_FALHOU",
    };
  }

  const avaliacao =
    avaliarRecuperacaoCompensacaoEvento({
      pagamentoId: pagamento.id,
      providerRef: compensacao.providerRef,
      valorOriginal: compensacao.valor,
      moeda: compensacao.moeda,
      statusCompensacao: compensacao.status,
      statusTentativa: tentativa.status,
      operacaoExternaExecutada:
        tentativa.operacaoExternaExecutada,
      evidencia,
    });

  const valorEstorno =
    evidencia.tipo === "ENCONTRADO" &&
    /^\d+(?:\.\d+)?$/.test(evidencia.valor)
      ? evidencia.valor
      : null;

  const consultaRegistrada =
    await prisma.billingCompensacaoConsultaRecuperacao.create({
      data: {
        compensacaoId: compensacao.id,
        tentativaId: tentativa.id,
        ambiente: "QA",
        simulada: true,

        tipoEvidencia: evidencia.tipo,
        decisao: avaliacao.decisao,
        motivo: avaliacao.motivo,
        identidadeConfirmada:
          avaliacao.identidadeConfirmada,

        providerRef: compensacao.providerRef,

        estornoId:
          evidencia.tipo === "ENCONTRADO"
            ? evidencia.estornoId
            : null,

        statusEstorno:
          evidencia.tipo === "ENCONTRADO"
            ? evidencia.status
            : null,

        valorEstorno,
        moedaEstorno:
          evidencia.tipo === "ENCONTRADO"
            ? evidencia.moeda
            : null,
      },
    });

  return {
    compensacaoId: compensacao.id,
    tentativaId: tentativa.id,
    consultaId: consultaRegistrada.id,
    evidencia,
    avaliacao,
    };
}