
import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import {
  BillingPendenciaEventoStatus,
  Prisma,
} from "@prisma/client";
import {
  consultarPagamentoMercadoPago,
  classificarConciliacaoMercadoPago,
} from "../services/billingConciliacaoMercadoPagoService.js";
import {
  obterPagamentoMercadoPago,
} from "../services/billingMercadoPagoGateway.js";

const STATUS_VALIDOS = new Set<string>(
  Object.values(BillingPendenciaEventoStatus)
);

export async function listarPendenciasEventoAdmin(
  req: Request,
  res: Response
) {
  try {
    const paginaRaw = Number(req.query.pagina ?? 1);
    const limiteRaw = Number(req.query.limite ?? 20);

    if (
      !Number.isSafeInteger(paginaRaw) ||
      paginaRaw < 1 ||
      !Number.isSafeInteger(limiteRaw) ||
      limiteRaw < 1
    ) {
      return res.status(400).json({
        code: "PAGINACAO_INVALIDA",
      });
    }

    const pagina = Math.min(paginaRaw, 100000);
    const limite = Math.min(limiteRaw, 100);

    const statusRaw = String(
      req.query.status ?? ""
    ).trim();

    if (
      statusRaw &&
      !STATUS_VALIDOS.has(statusRaw)
    ) {
      return res.status(400).json({
        code: "STATUS_INVALIDO",
      });
    }

    const pagamentoId = String(
      req.query.pagamentoId ?? ""
    ).trim();

    const where: Prisma.BillingPendenciaEventoWhereInput = {
      ...(statusRaw
        ? {
            status:
              statusRaw as BillingPendenciaEventoStatus,
          }
        : {}),
      ...(pagamentoId
        ? { pagamentoId }
        : {}),
    };

    const [total, registros] =
      await prisma.$transaction([
        prisma.billingPendenciaEvento.count({
          where,
        }),
        prisma.billingPendenciaEvento.findMany({
          where,
          orderBy: [
            { criadoEm: "desc" },
            { id: "desc" },
          ],
          skip: (pagina - 1) * limite,
          take: limite,
          select: {
            id: true,
            pagamentoId: true,
            eventoId: true,
            motivo: true,
            status: true,
            providerRef: true,
            valor: true,
            moeda: true,
            observacao: true,
            criadoEm: true,
            atualizadoEm: true,
            resolvidoEm: true,
            pagamento: {
              select: {
                usuarioId: true,
                plano: true,
                status: true,
                provider: true,
                criadoEm: true,
                pagoEm: true,
                usuario: {
                  select: {
                    id: true,
                    nome: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    return res.status(200).json({
      ok: true,
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      items: registros.map((item) => ({
        ...item,
        valor: item.valor.toFixed(2),
        pagamento: {
          ...item.pagamento,
        },
      })),
    });
  } catch (erro) {
    console.error(
      "[admin][billing] Erro ao listar pendências:",
      erro
    );

    return res.status(500).json({
      ok: false,
      code: "BILLING_PENDENCIAS_LIST_ERROR",
    });
  }
}

export async function verificarPendenciaEventoNoMpAdmin(
  req: Request,
  res: Response
) {
  try {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        pagamentoId
      )
    ) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    const pendencia =
      await prisma.billingPendenciaEvento.findUnique({
        where: {
          pagamentoId,
        },
        include: {
          pagamento: true,
        },
      });

    if (!pendencia) {
      return res.status(404).json({
        ok: false,
        code: "PENDENCIA_NAO_ENCONTRADA",
      });
    }

    const pg = pendencia.pagamento;

    if (
      pg.provider !== "MERCADOPAGO" ||
      pg.plano !== `EVENTO:${pendencia.eventoId}` ||
      pg.providerRef !== pendencia.providerRef ||
      !/^\d+$/.test(pendencia.providerRef)
    ) {
      return res.status(409).json({
        ok: false,
        code: "PENDENCIA_DADOS_INCONSISTENTES",
      });
    }

    // Somente consulta o provedor.
    // Nenhum pagamento ou pendencia sera atualizado.
    const mp = await obterPagamentoMercadoPago(
      pendencia.providerRef,
      consultarPagamentoMercadoPago
    );

    const classificacao =
      classificarConciliacaoMercadoPago(
        {
          id: pg.id,
          provider: pg.provider,
          providerRef: pg.providerRef,
          valor: pg.valor,
          moeda: pg.moeda,
          status: pg.status,
        },
        mp
      );

    // A classificação APROVAR serve à conciliação
    // normal. Para eventos sem vaga, ela NUNCA
    // autoriza conceder a inscrição.
    const identidadeFinanceiraConfirmada =
      ![
        "PROVEDOR_OU_ID_INVALIDO",
        "IDENTIDADE_NAO_COMPROVADA",
        "REFERENCIA_DIVERGENTE",
        "VALOR_OU_MOEDA_DIVERGENTE",
      ].includes(classificacao.motivo);

    return res.status(200).json({
      ok: true,
      pagamentoId: pg.id,
      pendenciaId: pendencia.id,
      statusPendencia: pendencia.status,
      statusPagamentoLocal: pg.status,
      mercadoPago: {
        id: String(mp.id ?? ""),
        status: String(mp.status ?? ""),
        statusDetail: mp.status_detail ?? null,
      },
      classificacao: {
        acao: classificacao.acao,
        motivo: classificacao.motivo,
        identidadeFinanceiraConfirmada,
      },
      exigeAnalise:
        true,
      podeAprovarAutomaticamente:
        false,
      estornoExecutado:
        false,
    });
  } catch (erro) {
    console.error(
      "[admin][billing] Falha na consulta externa:",
      erro
    );

    return res.status(503).json({
      ok: false,
      code: "MP_CONSULTA_INDISPONIVEL",
    });
  }
}
