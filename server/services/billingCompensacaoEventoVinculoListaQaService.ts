
import { prisma } from "../prisma.js";

import {
  consultarEAnalisarListaEstornosQa,
} from "./billingCompensacaoEventoConsultaListaQaService.js";

type Entrada = {
  pagamentoId: string;
  fetchQa: typeof fetch;
};

function validarAmbienteQa() {
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
      "QA_VINCULO_ESTORNOS_AMBIENTE_INSEGURO"
    );
  }
}

/**
 * Vincula a análise da lista de estornos ao
 * pagamento e à compensação reais no banco QA.
 *
 * SOMENTE LEITURA.
 * Não cria estorno.
 * Não atualiza pagamento ou compensação.
 * Não desbloqueia novas tentativas.
 */
export async function consultarListaEstornosCompensacaoQa(
  entrada: Entrada
) {
  validarAmbienteQa();

  const pagamentoId = String(
    entrada.pagamentoId ?? ""
  ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pagamentoId
    ) ||
    typeof entrada.fetchQa !== "function"
  ) {
    throw new Error(
      "QA_VINCULO_ESTORNOS_ENTRADA_INVALIDA"
    );
  }

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
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
      "QA_VINCULO_ESTORNOS_COMPENSACAO_INEXISTENTE"
    );
  }

  const pg = compensacao.pagamento;
  const pendencia = compensacao.pendencia;
  const tentativa =
    compensacao.historicoTentativas[0];

  if (
    !tentativa ||
    pg.id !== pagamentoId ||
    pg.provider !== "MERCADOPAGO" ||
    pg.status !== "PENDENTE" ||
    pg.reembolsadoEm !== null ||
    pg.plano !== `EVENTO:${pendencia.eventoId}` ||
    pg.providerRef !== compensacao.providerRef ||
    pendencia.providerRef !== compensacao.providerRef ||
    pendencia.pagamentoId !== pagamentoId ||
    pendencia.motivo !==
      "BILLING_EVENT_CAPACITY_EXCEEDED" ||
    !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
      pendencia.status
    ) ||
    !pg.valor.equals(compensacao.valor) ||
    !pendencia.valor.equals(compensacao.valor) ||
    pg.moeda !== "BRL" ||
    compensacao.moeda !== "BRL" ||
    pendencia.moeda !== "BRL" ||
    !/^\d+$/.test(compensacao.providerRef) ||
    compensacao.chaveIdempotencia !==
      `footera-evento-refund-${pagamentoId}` ||
    compensacao.status !==
      "AGUARDANDO_CONFIRMACAO" ||
    compensacao.tentativas !== 1 ||
    compensacao.confirmadoEm !== null ||
    tentativa.numero !== 1 ||
    tentativa.status !== "RESULTADO_DESCONHECIDO" ||
    tentativa.ambiente !== "QA" ||
    tentativa.operacaoExternaExecutada !== false
  ) {
    throw new Error(
      "QA_VINCULO_ESTORNOS_ESTADO_INCONSISTENTE"
    );
  }

  const [beneficios, inscricoes] =
    await Promise.all([
      prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      prisma.inscricaoEvento.count({
        where: {
          eventoId: pendencia.eventoId,
          usuarioId: pg.usuarioId,
          status: { not: "CANCELADA" },
        },
      }),
    ]);

  if (beneficios > 0 || inscricoes > 0) {
    throw new Error(
      "QA_VINCULO_ESTORNOS_ACESSO_EXISTENTE"
    );
  }

  const consulta =
    await consultarEAnalisarListaEstornosQa({
      pagamentoId: pg.id,
      providerRef: compensacao.providerRef,
      valorOriginal: compensacao.valor,
      moeda: compensacao.moeda,
      fetchQa: entrada.fetchQa,
    });

  return {
    pagamentoId: pg.id,
    compensacaoId: compensacao.id,
    tentativaId: tentativa.id,
    chaveIdempotencia:
      compensacao.chaveIdempotencia,
    consulta,

    // O vínculo da lista ao PAGAMENTO foi
    // verificado, mas não há evidência de que
    // um estorno específico foi iniciado por
    // esta compensação.
    operacaoEstornoDaCompensacaoComprovada: false,

    exigeAnaliseManual: true,
    executarNovoEstorno: false,
    atualizarPagamento: false,
    confirmarCompensacao: false,
  };
}