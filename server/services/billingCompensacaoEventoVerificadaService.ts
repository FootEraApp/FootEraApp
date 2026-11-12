
import { prisma } from "../prisma.js";

import {
  consultarPagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

import {
  obterPagamentoMercadoPago,
} from "./billingMercadoPagoGateway.js";

import {
  avaliarCompensacaoEvento,
} from "./billingCompensacaoEventoService.js";

import {
  prepararCompensacaoEvento,
} from "./billingCompensacaoEventoRegistroService.js";

/**
 * Confere o estado financeiro externo antes de
 * preparar uma compensacao interna.
 *
 * NAO realiza estorno.
 * NAO aprova pagamento.
 * NAO concede inscricao.
 */
export async function prepararCompensacaoEventoVerificada(
  pagamentoId: string
) {
  const id = String(pagamentoId ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ID_INVALIDO"
    );
  }

  const pendencia =
    await prisma.billingPendenciaEvento.findUnique({
      where: {
        pagamentoId: id,
      },
      include: {
        pagamento: true,
      },
    });

  if (!pendencia) {
    throw new Error(
      "BILLING_COMPENSACAO_PENDENCIA_NOT_FOUND"
    );
  }

  const pg = pendencia.pagamento;

  if (
    pendencia.motivo !==
      "BILLING_EVENT_CAPACITY_EXCEEDED" ||
    pg.provider !== "MERCADOPAGO" ||
    pg.plano !== `EVENTO:${pendencia.eventoId}` ||
    pg.status !== "PENDENTE" ||
    pg.moeda !== "BRL" ||
    pg.providerRef !== pendencia.providerRef ||
    !/^\d+$/.test(pendencia.providerRef) ||
    !pg.valor.equals(pendencia.valor) ||
    !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
      pendencia.status
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_DADOS_INVALIDOS"
    );
  }

  const [inscricoes, beneficios] =
    await Promise.all([
      prisma.inscricaoEvento.count({
        where: {
          eventoId: pendencia.eventoId,
          usuarioId: pg.usuarioId,
          status: {
            not: "CANCELADA",
          },
        },
      }),

      prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId: id,
        },
      }),
    ]);

  // Consultar o Mercado Pago ou o mock autorizado
  // pelo gateway QA. A falha da consulta bloqueia
  // qualquer preparacao.
  const mp = await obterPagamentoMercadoPago(
    pendencia.providerRef,
    consultarPagamentoMercadoPago
  );

  const avaliacao = avaliarCompensacaoEvento({
    pagamento: {
      id: pg.id,
      plano: pg.plano,
      provider: pg.provider,
      providerRef: pg.providerRef,
      valor: pg.valor,
      moeda: pg.moeda,
      status: pg.status,
    },
    eventoId: pendencia.eventoId,
    statusPendencia: pendencia.status,
    mp,
    possuiInscricao: inscricoes > 0,
    possuiBeneficio: beneficios > 0,
  });

  if (!avaliacao.candidataAnalise) {
    const erro = new Error(
      `BILLING_COMPENSACAO_NAO_ELEGIVEL:${avaliacao.motivo}`
    );

    throw erro;
  }

  // A função existente confere novamente o
  // estado local sob bloqueio FOR UPDATE
  // e cria somente um registro por pagamento.
  const resultado =
    await prepararCompensacaoEvento(id);

  return {
    ...resultado,
    verificacao: {
      statusMp: avaliacao.statusMp,
      motivo: avaliacao.motivo,
      acaoConciliacao:
        avaliacao.acaoConciliacao,
      consultadoEm: new Date().toISOString(),
      estornoExecutado: false,
    },
  };
}