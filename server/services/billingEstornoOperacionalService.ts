import type { Request } from "express";
import { prisma } from "../prisma.js";
import {
  construirAuditoriaDesfecho,
  persistirAuditoriaDesfecho,
} from "./billingEstornoDesfechoAuditoriaService.js";
import {
  validarExecutorEstorno,
  validarAutorizacaoEstornoAntesDoPreparo,
} from "./billingEstornoAdministrativoService.js";

import {
  executarEstornoRealControlado,
  conciliarEstornoReal,
} from "./billingCompensacaoEventoEnvioService.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarPagamentoId(
  pagamentoId: string
): void {
  if (!UUID.test(pagamentoId)) {
    throw new Error(
      "BILLING_OPERACIONAL_PAGAMENTO_ID_INVALIDO"
    );
  }
}

/**
 * Identidade retirada da requisicao autenticada.
 * Nunca aceitar executorId enviado pelo cliente.
 *
 * A rota precisa usar:
 * authenticateToken + requireAdmin.
 */
async function exigirOperadorHttpAutenticado(
  req: Request
): Promise<string> {
  const autenticada = req as Request & {
    userId?: string;
    user?: { id?: string };
    authUser?: { id?: string };
  };

  const executorId = String(
    autenticada.userId ??
      autenticada.user?.id ??
      autenticada.authUser?.id ??
      ""
  ).trim();

  if (!UUID.test(executorId)) {
    throw new Error(
      "BILLING_OPERACIONAL_SESSAO_INVALIDA"
    );
  }

  const administrador =
    await prisma.administrador.findUnique({
      where: { usuarioId: executorId },
      select: {
        usuarioId: true,
        usuario: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

  if (
    !administrador ||
    administrador.usuario.deletedAt
  ) {
    throw new Error(
      "BILLING_OPERACIONAL_ADMIN_INATIVO"
    );
  }

  await validarExecutorEstorno(executorId);

  return executorId;
}

/**
 * Previa somente leitura.
 *
 * Nao cria tentativa.
 * Nao altera pagamento.
 * Nao executa estorno.
 */
export async function consultarPreviaEstornoOperacional(
  pagamentoId: string,
  executorId: string
) {
  validarPagamentoId(pagamentoId);

  await validarExecutorEstorno(executorId);

  const [pagamento, compensacao, autorizacao] =
    await Promise.all([
      prisma.pagamento.findUnique({
        where: { id: pagamentoId },
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
      }),

      prisma.billingCompensacaoEvento.findUnique({
        where: { pagamentoId },
        include: {
          pendencia: {
            select: {
              status: true,
              motivo: true,
              eventoId: true,
              resolvidoEm: true,
            },
          },
          historicoTentativas: {
            select: {
              numero: true,
              ambiente: true,
              status: true,
              requisicaoEnviadaEm: true,
              postAutorizacaoConsumidaEm: true,
              operacaoExternaExecutada: true,
              estornoProviderRef: true,
            },
            orderBy: {
              numero: "desc",
            },
            take: 5,
          },
        },
      }),

      prisma.billingAutorizacaoEstorno.findUnique({
        where: { pagamentoId },
      }),
    ]);

  if (!pagamento) {
    throw new Error(
      "BILLING_OPERACIONAL_PAGAMENTO_AUSENTE"
    );
  }

  let preflightAprovado = false;
  let motivoBloqueio: string | null = null;

  try {
    await validarAutorizacaoEstornoAntesDoPreparo(
      pagamentoId,
      executorId
    );

    preflightAprovado = true;
  } catch (erro) {
    motivoBloqueio =
      erro instanceof Error
        ? erro.message
        : "BILLING_PREFLIGHT_INDISPONIVEL";
  }

  const execucaoRealHabilitada =
    process.env.NODE_ENV === "production" &&
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" &&
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED ===
      "true" &&
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true" &&
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED ===
      "true" &&
    Boolean(process.env.MP_ACCESS_TOKEN);

  return {
    pagamentoId,
    somenteConsulta: true,

    pagamento: {
      id: pagamento.id,
      plano: pagamento.plano,
      status: pagamento.status,
      valor: pagamento.valor.toString(),
      moeda: pagamento.moeda,
      provider: pagamento.provider,
      providerRef: pagamento.providerRef,
      reembolsadoEm: pagamento.reembolsadoEm,
    },

    compensacao: compensacao
      ? {
          id: compensacao.id,
          status: compensacao.status,
          valor: compensacao.valor.toString(),
          moeda: compensacao.moeda,
          tentativas: compensacao.tentativas,
          confirmadoEm: compensacao.confirmadoEm,
          pendencia: compensacao.pendencia,
          historicoTentativas:
            compensacao.historicoTentativas,
        }
      : null,

    autorizacao: autorizacao
      ? {
          id: autorizacao.id,
          status: autorizacao.status,
          valor: autorizacao.valor.toString(),
          moeda: autorizacao.moeda,
          solicitanteId:
            autorizacao.solicitanteId,
          aprovadorId:
            autorizacao.aprovadorId,
          aprovadoEm:
            autorizacao.aprovadoEm,
          expiraEm:
            autorizacao.expiraEm,
          consumidoEm:
            autorizacao.consumidoEm,
          revogadoEm:
            autorizacao.revogadoEm,
        }
      : null,

    preflightAprovado,
    motivoBloqueio,

    // Preflight aprovado nao autoriza sozinho
    // uma movimentacao financeira.
    execucaoRealHabilitada,

    estornoExecutado: false,
  };
}

async function registrarDesfechoOperacional(
  req: Request,
  operadorId: string,
  pagamentoId: string,
  operacao: "EXECUCAO" | "CONCILIACAO",
  resultado?: {
    motivo?: string;
    requerConciliacao?: boolean;
    enviado?: boolean | null;
    podeReenviar?: boolean;
  },
  erro?: unknown
): Promise<boolean> {
  const dados = construirAuditoriaDesfecho(
    req,
    operadorId,
    pagamentoId,
    operacao,
    resultado,
    erro
  );

  const registrada = await persistirAuditoriaDesfecho(
    dados,
    async (registro) => {
      await prisma.logAuditoria.create({
        data: registro,
      });
    }
  );

  if (!registrada) {
    console.error(
      "[billing] AUDITORIA_DESFECHO_FALHOU",
      { pagamentoId, operacao }
    );
  }

  return registrada;
}

export async function executarEstornoOperacionalHttp(
  req: Request,
  pagamentoId: string,
  confirmacao: string
) {
  validarPagamentoId(pagamentoId);

  // Bloqueio independente do gateway.
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BILLING_CUPOM_RESERVA_QA === "true" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "true" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "true" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !==
      "true" ||
    !process.env.MP_ACCESS_TOKEN
  ) {
    throw new Error(
      "BILLING_EXECUCAO_OPERACIONAL_DESABILITADA"
    );
  }

  // Confirmacao vinculada ao pagamento,
  // ao valor e a referencia do provedor.
  const pagamentoConfirmacao =
    await prisma.pagamento.findUnique({
      where: {
        id: pagamentoId,
      },
      select: {
        valor: true,
        moeda: true,
        provider: true,
        providerRef: true,
      },
    });

  if (
    !pagamentoConfirmacao ||
    pagamentoConfirmacao.provider !== "MERCADOPAGO" ||
    pagamentoConfirmacao.moeda !== "BRL" ||
    !pagamentoConfirmacao.providerRef ||
    !/^\d+$/.test(
      pagamentoConfirmacao.providerRef
    )
  ) {
    throw new Error(
      "BILLING_CONFIRMACAO_DADOS_INVALIDOS"
    );
  }

  const valorConfirmacao =
    pagamentoConfirmacao.valor.toFixed(2);

  const confirmacaoEsperada = [
    "ESTORNAR",
    pagamentoId,
    valorConfirmacao,
    pagamentoConfirmacao.providerRef,
  ].join(":");

  if (confirmacao !== confirmacaoEsperada) {
    throw new Error(
      "BILLING_CONFIRMACAO_EXPLICITA_INVALIDA"
    );
  }

  const executorId =
    await exigirOperadorHttpAutenticado(req);

  // Preflight evita um preparo desnecessario.
  // A validacao definitiva acontece na
  // transacao de aquisicao financeira.
  await validarAutorizacaoEstornoAntesDoPreparo(
    pagamentoId,
    executorId
  );

  // Auditoria obrigatoria antes do orquestrador.
  // Se falhar, a operacao nao prossegue.
  await prisma.logAuditoria.create({
    data: {
      usuarioId: executorId,
      acao: "BILLING_ESTORNO_EXECUCAO_SOLICITADA",
      entidade: "Pagamento",
      entidadeId: pagamentoId,
      descricao:
        "Execucao administrativa de estorno integral solicitada.",
      ip: req.ip ?? null,
      userAgent: String(
        req.headers["user-agent"] ?? ""
      ),
      meta: {
        pagamentoId,
        origem: "ADMIN_HTTP",
        confirmacaoRecebida: true,
      },
    },
  });

  // Este e o unico orquestrador que pode
  // iniciar o POST de estorno real.
  try {
    const resultado =
      await executarEstornoRealControlado(
        pagamentoId,
        executorId
      );

    const auditoriaDesfechoRegistrada =
      await registrarDesfechoOperacional(
        req,
        executorId,
        pagamentoId,
        "EXECUCAO",
        resultado
      );

    return {
      ...resultado,
      auditoriaDesfechoRegistrada,
      exigeRevisaoAuditoria:
        !auditoriaDesfechoRegistrada,
    };
  } catch (erro) {
    await registrarDesfechoOperacional(
      req,
      executorId,
      pagamentoId,
      "EXECUCAO",
      undefined,
      erro
    );

    // Nao executar novamente a partir deste erro.
    throw erro;
  }
}

/**
 * Conciliacao de um estorno existente.
 *
 * Nao inicia um segundo POST.
 * Exige identidade financeira autorizada.
 */
export async function conciliarEstornoOperacionalHttp(
  req: Request,
  pagamentoId: string
) {
  validarPagamentoId(pagamentoId);

  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BILLING_CUPOM_RESERVA_QA === "true" ||
    !process.env.MP_ACCESS_TOKEN
  ) {
    throw new Error(
      "BILLING_CONCILIACAO_OPERACIONAL_INDISPONIVEL"
    );
  }

  const executorId =
    await exigirOperadorHttpAutenticado(req);

  // Auditoria obrigatoria antes de consultar
  // o provedor.
  await prisma.logAuditoria.create({
    data: {
      usuarioId: executorId,
      acao: "BILLING_ESTORNO_CONCILIACAO_SOLICITADA",
      entidade: "Pagamento",
      entidadeId: pagamentoId,
      descricao:
        "Conciliacao administrativa de estorno existente.",
      ip: req.ip ?? null,
      userAgent: String(
        req.headers["user-agent"] ?? ""
      ),
      meta: {
        pagamentoId,
        origem: "ADMIN_HTTP",
        novoEnvioAutorizado: false,
      },
    },
  });

  try {
    const resultado =
      await conciliarEstornoReal(pagamentoId);

    const auditoriaDesfechoRegistrada =
      await registrarDesfechoOperacional(
        req,
        executorId,
        pagamentoId,
        "CONCILIACAO",
        resultado
      );

    return {
      ...resultado,
      auditoriaDesfechoRegistrada,
      exigeRevisaoAuditoria:
        !auditoriaDesfechoRegistrada,
    };
  } catch (erro) {
    await registrarDesfechoOperacional(
      req,
      executorId,
      pagamentoId,
      "CONCILIACAO",
      undefined,
      erro
    );

    // A conciliacao nao autoriza novo POST.
    throw erro;
  }
}