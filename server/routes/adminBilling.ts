
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import { prisma } from "../prisma.js";
import { auditFinanceiroObrigatorio } from "../services/audit.js";
import type { Request } from "express";
import {
  solicitarAutorizacaoEstorno,
  aprovarAutorizacaoEstorno,
  revogarAutorizacaoEstorno,
  consultarAutorizacaoEstorno,
  validarExecutorEstorno,
} from "../services/billingEstornoAdministrativoService.js";
import {
  consultarPreviaEstornoOperacional,
  executarEstornoOperacionalHttp,
  conciliarEstornoOperacionalHttp,
} from "../services/billingEstornoOperacionalService.js";

const router = Router();

router.post(
  "/billing/run-daily",
  authenticateToken,
  requireAdmin,
  (_req, res) => {
    return res.status(503).json({
      ok: false,
      code: "BILLING_LEGACY_SCHEDULER_DISABLED",
      message:
        "Rotina administrativa indisponível durante a unificação do billing.",
    });
  }
);

// Somente consulta. Não executa estorno.
router.get(
  "/billing/estornos/:pagamentoId/status",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId =
      String(req.params.pagamentoId ?? "").trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        pagamentoId
      )
    ) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    try {
      // Exige permissao financeira especifica,
      // alem de authenticateToken e requireAdmin.
      await validarExecutorEstorno(
        operadorFinanceiroId(req)
      );

      const compensacao =
        await prisma.billingCompensacaoEvento.findUnique({
          where: { pagamentoId },
          include: {
            pagamento: {
              select: {
                id: true,
                plano: true,
                status: true,
                valor: true,
                moeda: true,
                provider: true,
                providerRef: true,
                reembolsadoEm: true,
              },
            },
            pendencia: {
              select: {
                status: true,
                motivo: true,
                resolvidoEm: true,
              },
            },
            historicoTentativas: {
              orderBy: { numero: "desc" },
              take: 5,
              select: {
                id: true,
                numero: true,
                ambiente: true,
                status: true,
                requisicaoEnviadaEm: true,
                postAutorizacaoConsumidaEm: true,
                operacaoExternaExecutada: true,
                estornoProviderRef: true,
              },
            },
          },
        });

      if (!compensacao) {
        return res.status(404).json({
          ok: false,
          code: "COMPENSACAO_NAO_ENCONTRADA",
        });
      }

      await auditFinanceiroObrigatorio(req, {
        acao: "BILLING_ESTORNO_CONSULTA_ADMIN",
        entidadeId: pagamentoId,
        descricao:
          "Consulta administrativa do estado da compensação.",
        meta: {
          statusCompensacao: compensacao.status,
          numeroTentativas: compensacao.tentativas,
        },
      });

      return res.json({
        ok: true,
        pagamento: compensacao.pagamento,
        compensacao: {
          id: compensacao.id,
          status: compensacao.status,
          tentativas: compensacao.tentativas,
          confirmadoEm: compensacao.confirmadoEm,
        },
        pendencia: compensacao.pendencia,
        tentativas: compensacao.historicoTentativas,
        podeExecutarNovoEstorno: false,
        operacaoExecutada: false,
      });
    } catch (erro) {
      const codigo = erroAdministrativoEstorno(erro);

      if (
        codigo ===
          "BILLING_OPERADOR_FINANCEIRO_NAO_AUTORIZADO" ||
        codigo === "BILLING_OPERADOR_ADMIN_INATIVO"
      ) {
        return res.status(403).json({
          ok: false,
          code: codigo,
        });
      }

      console.error(
        "[billing-admin] Falha na consulta de estorno:",
        erro
      );

      return res.status(503).json({
        ok: false,
        code: "CONSULTA_FINANCEIRA_INDISPONIVEL",
      });
    }
  }
);

/*
 * ETAPA 4 — Autorizações administrativas de estorno
 *
 * Todas as operações exigem sessão autenticada.
 * Os serviços verificam as listas financeiras específicas.
 *
 * NÃO realiza HTTP com o Mercado Pago.
 */

function operadorFinanceiroId(req: Request): string {
  return String(
    (req as Request & {
      userId?: string;
      user?: { id?: string };
      authUser?: { id?: string };
    }).userId ??
      (req as Request & {
        user?: { id?: string };
      }).user?.id ??
      (req as Request & {
        authUser?: { id?: string };
      }).authUser?.id ??
      ""
  ).trim();
}

const UUID_BILLING =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erroAdministrativoEstorno(
  erro: unknown
): string {
  const codigo =
    erro instanceof Error ? erro.message : "";

  if (
    codigo.startsWith("BILLING_") &&
    /^[A-Z0-9_]+$/.test(codigo)
  ) {
    return codigo;
  }

  return "BILLING_OPERACAO_ADMIN_INDISPONIVEL";
}

function statusErroOperacional(
  codigo: string
): number {
  switch (codigo) {
    case "BILLING_OPERACIONAL_PAGAMENTO_ID_INVALIDO":
    case "BILLING_CONFIRMACAO_EXPLICITA_INVALIDA":
      return 400;

    case "BILLING_OPERACIONAL_PAGAMENTO_AUSENTE":
      return 404;

    case "BILLING_OPERACIONAL_SESSAO_INVALIDA":
      return 401;

    case "BILLING_OPERADOR_FINANCEIRO_NAO_AUTORIZADO":
    case "BILLING_OPERACIONAL_ADMIN_INATIVO":
    case "BILLING_AUTORIZACAO_FINANCEIRA_AUSENTE":
    case "BILLING_AUTORIZACAO_FINANCEIRA_NAO_APROVADA":
    case "BILLING_AUTORIZACAO_DADOS_FINANCEIROS_DIVERGENTES":
      return 403;

    case "BILLING_EXECUCAO_OPERACIONAL_DESABILITADA":
    case "BILLING_CONCILIACAO_OPERACIONAL_INDISPONIVEL":
      return 503;

    default:
      // Erros nao classificados nunca autorizam
      // repeticao automatica do estorno.
      return 503;
  }
}

// Solicitar autorização — não executa estorno.
router.post(
  "/billing/estornos/:pagamentoId/solicitar",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    const motivo = req.body?.motivo;

    if (!UUID_BILLING.test(pagamentoId)) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    if (
      typeof motivo !== "string" ||
      motivo.trim().length < 20 ||
      motivo.trim().length > 1000
    ) {
      return res.status(400).json({
        ok: false,
        code: "BILLING_MOTIVO_INVALIDO",
      });
    }

    try {
      const operadorId = operadorFinanceiroId(req);

      const autorizacao =
        await solicitarAutorizacaoEstorno(
          pagamentoId,
          operadorId,
          motivo
        );

      return res.status(201).json({
        ok: true,
        autorizacaoId: autorizacao.id,
        pagamentoId,
        status: autorizacao.status,
        valor: autorizacao.valor.toString(),
        moeda: autorizacao.moeda,
        solicitanteId: autorizacao.solicitanteId,
        criadoEm: autorizacao.criadoEm,
        estornoExecutado: false,
      });
    } catch (erro) {
      console.error(
        "[billing-admin] Solicitação recusada:",
        erro
      );

      return res.status(403).json({
        ok: false,
        code: erroAdministrativoEstorno(erro),
      });
    }
  }
);

// Aprovar — exige outro administrador autorizado.
router.post(
  "/billing/estornos/:pagamentoId/aprovar",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    if (!UUID_BILLING.test(pagamentoId)) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    try {
      const resultado =
        await aprovarAutorizacaoEstorno(
          pagamentoId,
          operadorFinanceiroId(req)
        );

      return res.status(200).json({
        ok: true,
        ...resultado,
        status: "APROVADA",
        estornoExecutado: false,
      });
    } catch (erro) {
      console.error(
        "[billing-admin] Aprovação recusada:",
        erro
      );

      return res.status(403).json({
        ok: false,
        code: erroAdministrativoEstorno(erro),
      });
    }
  }
);

// Revogar — somente antes do consumo.
router.post(
  "/billing/estornos/:pagamentoId/revogar",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    if (!UUID_BILLING.test(pagamentoId)) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    try {
      const resultado =
        await revogarAutorizacaoEstorno(
          pagamentoId,
          operadorFinanceiroId(req)
        );

      return res.status(200).json({
        ok: true,
        ...resultado,
        estornoExecutado: false,
      });
    } catch (erro) {
      console.error(
        "[billing-admin] Revogação recusada:",
        erro
      );

      return res.status(403).json({
        ok: false,
        code: erroAdministrativoEstorno(erro),
      });
    }
  }
);

// Consulta da autorização, sem efeitos financeiros.
router.get(
  "/billing/estornos/:pagamentoId/autorizacao",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    if (!UUID_BILLING.test(pagamentoId)) {
      return res.status(400).json({
        ok: false,
        code: "PAGAMENTO_ID_INVALIDO",
      });
    }

    try {
      const autorizacao =
        await consultarAutorizacaoEstorno(
          pagamentoId,
          operadorFinanceiroId(req)
        );

      if (!autorizacao) {
        return res.status(404).json({
          ok: false,
          code: "BILLING_AUTORIZACAO_NAO_ENCONTRADA",
        });
      }

      return res.status(200).json({
        ok: true,
        autorizacao: {
          id: autorizacao.id,
          pagamentoId: autorizacao.pagamentoId,
          status: autorizacao.status,
          motivo: autorizacao.motivo,
          valor: autorizacao.valor.toString(),
          moeda: autorizacao.moeda,
          solicitanteId: autorizacao.solicitanteId,
          aprovadorId: autorizacao.aprovadorId,
          criadoEm: autorizacao.criadoEm,
          aprovadoEm: autorizacao.aprovadoEm,
          expiraEm: autorizacao.expiraEm,
          consumidoEm: autorizacao.consumidoEm,
          revogadoEm: autorizacao.revogadoEm,
        },
        estornoExecutadoNestaConsulta: false,
      });
    } catch (erro) {
      console.error(
        "[billing-admin] Consulta recusada:",
        erro
      );

      return res.status(403).json({
        ok: false,
        code: erroAdministrativoEstorno(erro),
      });
    }
  }
);

// ETAPA 4 — Prévia operacional do estorno.
// Somente consulta, sem POST ao Mercado Pago.
router.get(
  "/billing/estornos/:pagamentoId/previa",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    const operadorId = String(
      (req as any).userId ??
      (req as any).user?.id ??
      (req as any).authUser?.id ??
      ""
    ).trim();

    try {
      const previa =
        await consultarPreviaEstornoOperacional(
          pagamentoId,
          operadorId
        );

      return res.status(200).json({
        ok: true,
        ...previa,
      });
    } catch (erro) {
      console.error(
        "[billing-admin] Falha na prévia operacional:",
        erro
      );

      return res.status(403).json({
        ok: false,
        code:
          erro instanceof Error &&
          /^BILLING_[A-Z0-9_]+$/.test(erro.message)
            ? erro.message
            : "BILLING_PREVIA_INDISPONIVEL",
      });
    }
  }
);


/**
 * ETAPA 4 — Execucao administrativa excepcional.
 *
 * O endpoint nao acessa diretamente o gateway.
 * Exige JWT, Admin e autorizacao financeira.
 * O servico operacional aplica as flags de bloqueio.
 */
router.post(
  "/billing/estornos/:pagamentoId/executar",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    const confirmacao = String(
      req.body?.confirmacao ?? ""
    ).trim();

    try {
      const resultado =
        await executarEstornoOperacionalHttp(
          req,
          pagamentoId,
          confirmacao
        );

      const requerConciliacao =
        resultado.requerConciliacao === true;

      const exigeRevisaoAuditoria =
        resultado.exigeRevisaoAuditoria === true;

      const estornoConfirmado =
        resultado.enviado === true &&
        resultado.requerConciliacao === false &&
        resultado.motivo === "ESTORNO_EXTERNO_CONFIRMADO";

      const compensacaoJaConfirmada =
        resultado.motivo === "COMPENSACAO_JA_CONFIRMADA";

      return res
        .status(
          requerConciliacao || exigeRevisaoAuditoria
            ? 202
            : 200
        )
        .json({
          ok: true,
          resultado,
          requerConciliacao,
          exigeRevisaoAuditoria,
          estornoConfirmado,
          compensacaoJaConfirmada,
          podeReenviar: false,
        });

    } catch (erro) {
      const codigo =
        erro instanceof Error &&
        /^BILLING_[A-Z0-9_]+$/.test(erro.message)
          ? erro.message
          : "BILLING_EXECUCAO_OPERACIONAL_INDISPONIVEL";

      console.error(
        "[billing-admin] Execucao operacional recusada:",
        codigo
      );

      return res
        .status(statusErroOperacional(codigo))
        .json({
          ok: false,
          code: codigo,
          podeReenviar: false,
        });
    }
  }
);

/**
 * ETAPA 4 — Conciliacao administrativa.
 *
 * Nao executa um segundo POST de estorno.
 * Pode consultar evidencias e finalizar uma
 * compensacao ja confirmada externamente.
 */
router.post(
  "/billing/estornos/:pagamentoId/conciliar",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const pagamentoId = String(
      req.params.pagamentoId ?? ""
    ).trim();

    try {
      const resultado =
        await conciliarEstornoOperacionalHttp(
          req,
          pagamentoId
        );

      const requerConciliacao =
        "requerConciliacao" in resultado &&
        resultado.requerConciliacao === true;

      const exigeRevisaoAuditoria =
        resultado.exigeRevisaoAuditoria === true;

      return res
        .status(
          requerConciliacao || exigeRevisaoAuditoria
            ? 202
            : 200
        )
        .json({
          ok: true,
          resultado,
          requerConciliacao,
          exigeRevisaoAuditoria,
          podeReenviar: false,
        });

    } catch (erro) {
      const codigo =
        erro instanceof Error &&
        /^BILLING_[A-Z0-9_]+$/.test(erro.message)
          ? erro.message
          : "BILLING_CONCILIACAO_OPERACIONAL_INDISPONIVEL";

      console.error(
        "[billing-admin] Conciliacao recusada:",
        codigo
      );

      return res
        .status(statusErroOperacional(codigo))
        .json({
          ok: false,
          code: codigo,
          podeReenviar: false,
        });
    }
  }
);

export default router;