
import {
  PagamentoStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../prisma.js";

import {
  consultarEvidenciaEstornoMercadoPago,
} from "./billingEstornoMercadoPagoGateway.js";

type CompensacaoCarregada =
  Prisma.BillingCompensacaoEventoGetPayload<{
    include: {
      pagamento: true;
      pendencia: true;
      historicoTentativas: true;
    };
  }>;

type TentativaCarregada =
  CompensacaoCarregada["historicoTentativas"][number];

type ModoFinalizacao = "REAL" | "QA";

const INCLUIR_COMPENSACAO = {
  pagamento: true,
  pendencia: true,
  historicoTentativas: true,
} as const;

const STATUS_PENDENCIA_PERMITIDOS = [
  "PENDENTE_ANALISE",
  "EM_ANALISE",
  "AGUARDANDO_ESTORNO",
];

const OPCOES_TRANSACAO = {
  isolationLevel:
    Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10000,
  timeout: 15000,
};

function validarPagamentoId(
  pagamentoId: string
): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pagamentoId
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ID_INVALIDO"
    );
  }
}

function validarAmbienteReal(): void {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.BILLING_CUPOM_RESERVA_QA === "true" ||
    !process.env.MP_ACCESS_TOKEN
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_FINALIZACAO_REAL_INDISPONIVEL"
    );
  }
}

async function validarAmbienteQa(): Promise<void> {
  let url: URL;

  try {
    url = new URL(
      process.env.DATABASE_URL ?? ""
    );
  } catch {
    throw new Error(
      "QA_DATABASE_URL_INVALIDA"
    );
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      url.hostname
    ) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_FINALIZACAO_TRANSACIONAL_QA_DISABLED"
    );
  }

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  if (
    banco[0]?.nome !== "footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_FINALIZACAO_TRANSACIONAL_BANCO_INVALIDO"
    );
  }
}

function validarTentativa(
  c: CompensacaoCarregada,
  t: TentativaCarregada | undefined,
  pagamentoId: string,
  modo: ModoFinalizacao
): boolean {
  if (
    !t ||
    c.historicoTentativas.length !== 1 ||
    c.tentativas !== 1 ||
    t.numero !== 1 ||
    t.compensacaoId !== c.id ||
    c.chaveIdempotencia !==
      `footera-evento-refund-${pagamentoId}` ||
    t.chaveIdempotenciaOperacao !==
      c.chaveIdempotencia
  ) {
    return false;
  }

  if (modo === "QA") {
    return (
      t.ambiente === "QA" &&
      t.operacaoExternaExecutada === false &&
      t.requisicaoEnviadaEm === null &&
      t.estornoProviderRef === null &&
      t.status ===
        "CONFIRMACAO_EXTERNA_PENDENTE"
    );
  }

  return (
    t.ambiente !== "QA" &&
    t.operacaoExternaExecutada === true &&
    t.requisicaoEnviadaEm !== null &&
    typeof t.estornoProviderRef === "string" &&
    /^\d+$/.test(t.estornoProviderRef)
  );
}

function validarEstadoConfirmado(
  c: CompensacaoCarregada,
  pagamentoId: string,
  modo: ModoFinalizacao
): void {
  const t = c.historicoTentativas[0];

  if (
    c.status !== "CONFIRMADA" ||
    c.confirmadoEm === null ||
    c.pagamento.id !== pagamentoId ||
    c.pagamento.status !==
      PagamentoStatus.REEMBOLSADO ||
    c.pagamento.reembolsadoEm === null ||
    c.pendencia.pagamentoId !== pagamentoId ||
    c.pendencia.status !== "ESTORNO_CONFIRMADO" ||
    c.pendencia.resolvidoEm === null ||
    !validarTentativa(
      c,
      t,
      pagamentoId,
      modo
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_FINALIZADA_INCONSISTENTE"
    );
  }
}

function validarEstadoPendente(
  atual: CompensacaoCarregada,
  original: CompensacaoCarregada,
  tentativa: TentativaCarregada,
  pagamentoId: string,
  modo: ModoFinalizacao
): void {
  const t = atual.historicoTentativas[0];

  if (
    atual.status !== "AGUARDANDO_CONFIRMACAO" ||
    atual.confirmadoEm !== null ||
    !validarTentativa(
      atual,
      t,
      pagamentoId,
      modo
    ) ||
    !t ||
    t.id !== tentativa.id ||
    t.estornoProviderRef !==
      tentativa.estornoProviderRef ||
    atual.providerRef !== original.providerRef ||
    !atual.valor.equals(original.valor) ||
    atual.pagamento.id !== pagamentoId ||
    atual.pagamento.provider !== "MERCADOPAGO" ||
    atual.pagamento.status !==
      PagamentoStatus.PENDENTE ||
    atual.pagamento.reembolsadoEm !== null ||
    atual.pagamento.providerRef !==
      atual.providerRef ||
    atual.pagamento.plano !==
      `EVENTO:${atual.pendencia.eventoId}` ||
    atual.pendencia.pagamentoId !== pagamentoId ||
    atual.pendencia.providerRef !==
      atual.providerRef ||
    atual.pendencia.motivo !==
      "BILLING_EVENT_CAPACITY_EXCEEDED" ||
    atual.pendencia.resolvidoEm !== null ||
    !STATUS_PENDENCIA_PERMITIDOS.includes(
      atual.pendencia.status
    ) ||
    atual.moeda !== "BRL" ||
    atual.pagamento.moeda !== "BRL" ||
    atual.pendencia.moeda !== "BRL" ||
    !atual.pagamento.valor.equals(
      atual.valor
    ) ||
    !atual.pendencia.valor.equals(
      atual.valor
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ESTADO_MUDOU"
    );
  }
}

/**
 * Núcleo transacional compartilhado.
 *
 * REAL:
 * somente após evidência externa verificada.
 *
 * QA:
 * somente após validação estrita do ambiente.
 *
 * Nunca realiza HTTP e nunca envia estorno.
 */
async function executarFinalizacaoTransacional(
  pagamentoId: string,
  original: CompensacaoCarregada,
  tentativa: TentativaCarregada,
  modo: ModoFinalizacao,
  falharDepoisPagamento: boolean
) {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${pagamentoId}
        FOR UPDATE
      `;

      if (locked.length !== 1) {
        throw new Error(
          "BILLING_COMPENSACAO_PAGAMENTO_AUSENTE"
        );
      }

      const atual =
        await tx.billingCompensacaoEvento.findUniqueOrThrow({
          where: { pagamentoId },
          include: INCLUIR_COMPENSACAO,
        });

      if (atual.status === "CONFIRMADA") {
        validarEstadoConfirmado(
          atual,
          pagamentoId,
          modo
        );

        return {
          pagamentoId,
          idempotente: true,
        };
      }

      validarEstadoPendente(
        atual,
        original,
        tentativa,
        pagamentoId,
        modo
      );

      const beneficios =
        await tx.pagamentoBeneficio.count({
          where: { pagamentoId },
        });

      const inscricoes =
        await tx.inscricaoEvento.count({
          where: {
            eventoId:
              atual.pendencia.eventoId,
            usuarioId:
              atual.pagamento.usuarioId,
            status: {
              not: "CANCELADA",
            },
          },
        });

      if (
        beneficios !== 0 ||
        inscricoes !== 0
      ) {
        throw new Error(
          "BILLING_COMPENSACAO_ACESSO_EXISTENTE"
        );
      }

      const agora = new Date();

      const pg =
        await tx.pagamento.updateMany({
          where: {
            id: pagamentoId,
            status:
              PagamentoStatus.PENDENTE,
            reembolsadoEm: null,
          },
          data: {
            status:
              PagamentoStatus.REEMBOLSADO,
            reembolsadoEm: agora,
          },
        });

      if (pg.count !== 1) {
        throw new Error(
          "BILLING_COMPENSACAO_PAGAMENTO_CONFLITO"
        );
      }

      if (
        modo === "QA" &&
        falharDepoisPagamento
      ) {
        throw new Error(
          "QA_FALHA_FORCADA_APOS_PAGAMENTO"
        );
      }

      const pendencia =
        await tx.billingPendenciaEvento.updateMany({
          where: {
            id: atual.pendenciaId,
            status:
              atual.pendencia.status,
          },
          data: {
            status:
              "ESTORNO_CONFIRMADO",
            resolvidoEm: agora,
          },
        });

      if (pendencia.count !== 1) {
        throw new Error(
          "BILLING_COMPENSACAO_PENDENCIA_CONFLITO"
        );
      }

      const compensacao =
        await tx.billingCompensacaoEvento.updateMany({
          where: {
            id: atual.id,
            status:
              "AGUARDANDO_CONFIRMACAO",
            confirmadoEm: null,
          },
          data: {
            status: "CONFIRMADA",
            confirmadoEm: agora,
            ultimoErro: null,
          },
        });

      if (compensacao.count !== 1) {
        throw new Error(
          "BILLING_COMPENSACAO_STATUS_CONFLITO"
        );
      }

      return {
        pagamentoId,
        idempotente: false,
      };
    },
    OPCOES_TRANSACAO
  );
}

/**
 * Finalização REAL.
 *
 * Não cria estorno.
 * Exige comprovante externo do Mercado Pago.
 * Não utiliza mock QA.
 */
export async function finalizarCompensacaoEventoVerificada(
  pagamentoId: string
) {
  validarPagamentoId(pagamentoId);
  validarAmbienteReal();

  const c =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: INCLUIR_COMPENSACAO,
    });

  if (!c) {
    throw new Error(
      "BILLING_COMPENSACAO_NAO_ENCONTRADA"
    );
  }

  if (c.status === "CONFIRMADA") {
    return prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "Pagamento"
          WHERE "id" = ${pagamentoId}
          FOR UPDATE
        `;

        if (locked.length !== 1) {
          throw new Error(
            "BILLING_COMPENSACAO_PAGAMENTO_AUSENTE"
          );
        }

        const atual =
          await tx.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
            include: INCLUIR_COMPENSACAO,
          });

        validarEstadoConfirmado(
          atual,
          pagamentoId,
          "REAL"
        );

        return {
          pagamentoId,
          idempotente: true,
        };
      },
      OPCOES_TRANSACAO
    );
  }

  const tentativa =
    c.historicoTentativas[0];

  if (
    c.status !== "AGUARDANDO_CONFIRMACAO" ||
    c.confirmadoEm !== null ||
    !validarTentativa(
      c,
      tentativa,
      pagamentoId,
      "REAL"
    ) ||
    !tentativa ||
    c.pagamento.status !==
      PagamentoStatus.PENDENTE ||
    c.pagamento.reembolsadoEm !== null
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_EVIDENCIA_LOCAL_INSUFICIENTE"
    );
  }

  validarEstadoPendente(
    c,
    c,
    tentativa,
    pagamentoId,
    "REAL"
  );

  const centavos =
    c.valor.mul(100).toNumber();

  if (
    !Number.isSafeInteger(centavos) ||
    centavos <= 0
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_VALOR_INVALIDO"
    );
  }

  await consultarEvidenciaEstornoMercadoPago({
    pagamentoProviderRef:
      c.providerRef,
    estornoProviderRef:
      tentativa.estornoProviderRef!,
    valorEsperado: c.valor,
    moeda: c.moeda,
  });

  return executarFinalizacaoTransacional(
    pagamentoId,
    c,
    tentativa,
    "REAL",
    false
  );
}

/**
 * Entrada exclusiva de testes no banco local QA.
 *
 * Não envia requisição HTTP.
 * Não produz estorno real.
 * Não conectar a rotas ou jobs.
 */
export async function finalizarCompensacaoEventoTransacionalQa(
  pagamentoId: string,
  opcoes: {
    falharDepoisPagamento?: boolean;
  } = {}
) {
  await validarAmbienteQa();
  validarPagamentoId(pagamentoId);

  const c =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: INCLUIR_COMPENSACAO,
    });

  if (!c) {
    throw new Error(
      "QA_COMPENSACAO_NAO_ENCONTRADA"
    );
  }

  const tentativa =
    c.historicoTentativas[0];

  if (
    !validarTentativa(
      c,
      tentativa,
      pagamentoId,
      "QA"
    ) ||
    !tentativa ||
    ![
      "AGUARDANDO_CONFIRMACAO",
      "CONFIRMADA",
    ].includes(c.status)
  ) {
    throw new Error(
      "QA_TENTATIVA_INCONSISTENTE"
    );
  }

  if (c.status === "CONFIRMADA") {
    validarEstadoConfirmado(
      c,
      pagamentoId,
      "QA"
    );
  }

  return executarFinalizacaoTransacional(
    pagamentoId,
    c,
    tentativa,
    "QA",
    opcoes.falharDepoisPagamento === true
  );
}