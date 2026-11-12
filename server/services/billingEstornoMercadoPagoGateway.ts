// server/services/billingEstornoMercadoPagoGateway.ts
import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

import {
  consultarEstornosPagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";

/**
 * Gateway de consulta dos estornos de eventos.
 *
 * SEGURANÇA:
 * - Consulta somente estornos existentes.
 * - Não cria novas solicitações de estorno.
 * - Não altera o banco de dados.
 * - Não confirma compensações.
 * - Não concede nem revoga benefícios.
 *
 * O envio real permanece desabilitado até
 * a homologação da operação externa.
 */

export type EvidenciaEstornoMercadoPago = {
  pagamentoProviderRef: string;
  estornoProviderRef: string;
  status: string;
  valor: Prisma.Decimal;
  moeda: string;
};

type EstornoExterno = {
  id?: string | number;
  payment_id?: string | number;
  status?: string;
  amount?: number | string;
};

export async function consultarEvidenciaEstornoMercadoPago(
  args: {
    pagamentoProviderRef: string;
    estornoProviderRef: string;
    valorEsperado: Prisma.Decimal | string | number;
    moeda: string;
  }
): Promise<EvidenciaEstornoMercadoPago> {
  const pagamentoProviderRef =
    String(args.pagamentoProviderRef ?? "").trim();

  const estornoProviderRef =
    String(args.estornoProviderRef ?? "").trim();

  if (
    !/^\d+$/.test(pagamentoProviderRef) ||
    !/^\d+$/.test(estornoProviderRef) ||
    args.moeda !== "BRL"
  ) {
    throw new Error(
      "BILLING_ESTORNO_IDENTIDADE_INVALIDA"
    );
  }

  const valorEsperado = new Prisma.Decimal(
    args.valorEsperado
  );

  if (
    !valorEsperado.isFinite() ||
    valorEsperado.lessThanOrEqualTo(0) ||
    !valorEsperado.mul(100).isInteger()
  ) {
    throw new Error(
      "BILLING_ESTORNO_VALOR_INVALIDO"
    );
  }

  const estornos =
    await consultarEstornosPagamentoMercadoPago(
      pagamentoProviderRef
    );

  const encontrados = (
    estornos as EstornoExterno[]
  ).filter(
    (estorno) =>
      String(estorno.id ?? "") ===
      estornoProviderRef
  );

  if (encontrados.length !== 1) {
    throw new Error(
      "BILLING_ESTORNO_NAO_COMPROVADO"
    );
  }

  const estorno = encontrados[0];

  if (
    estorno.payment_id == null ||
    String(estorno.payment_id) !== pagamentoProviderRef
    ) {
    throw new Error(
      "BILLING_ESTORNO_PAGAMENTO_DIVERGENTE"
    );
  }

  const valorExterno = new Prisma.Decimal(
    estorno.amount ?? 0
  );

  if (
    estorno.status !== "approved" ||
    !valorExterno.equals(valorEsperado)
  ) {
    throw new Error(
      "BILLING_ESTORNO_NAO_CONFIRMADO"
    );
  }

  return {
    pagamentoProviderRef,
    estornoProviderRef,
    status: "approved",
    valor: valorExterno,
    moeda: "BRL",
  };
}

export type ResultadoTransporteEstorno = {
  resultado:
    | "CONFIRMADO"
    | "NAO_CONFIRMADO"
    | "DESCONHECIDO";

  estornoProviderRef: string | null;
  pagamentoProviderRef: string;
  statusHttp: number | null;
  motivo: string;
};

type EnviarEstornoArgs = {
  pagamentoProviderRef: string;
  chaveIdempotencia: string;
  valorEsperadoCentavos: number;
  token: string;
  fetchImpl: typeof fetch;
};

export async function testarTransporteEstornoMercadoPagoQa(
  args: EnviarEstornoArgs
): Promise<ResultadoTransporteEstorno> {
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(
      process.env.DATABASE_URL ?? ""
    );
  } catch {
    throw new Error(
      "BILLING_TRANSPORTE_QA_DATABASE_INVALIDA"
    );
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    databaseUrl.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      databaseUrl.hostname
    ) ||
    databaseUrl.port !== "5433" ||
    databaseUrl.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_TRANSPORTE_ESTORNO_QA_DISABLED"
    );
  }

  if (
    !/^\d+$/.test(args.pagamentoProviderRef) ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(
      args.chaveIdempotencia
    ) ||
    !Number.isSafeInteger(
      args.valorEsperadoCentavos
    ) ||
    args.valorEsperadoCentavos <= 0 ||
    !args.token.trim() ||
    typeof args.fetchImpl !== "function"
  ) {
    throw new Error(
      "BILLING_TRANSPORTE_ESTORNO_ARGUMENTOS_INVALIDOS"
    );
  }

  const resultadoBase = {
    pagamentoProviderRef:
      args.pagamentoProviderRef,
  };

  let response: Response;

  try {
    response = await args.fetchImpl(
      `https://api.mercadopago.com/v1/payments/${
        encodeURIComponent(args.pagamentoProviderRef)
      }/refunds`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${args.token}`,
          "X-Idempotency-Key":
            args.chaveIdempotencia,
          "Content-Type":
            "application/json",
          Accept: "application/json",
        },

        // Reembolso TOTAL: não informar amount.
        body: "{}",
        signal:
          AbortSignal.timeout(10000),
      }
    );
  } catch {
    return {
      ...resultadoBase,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: null,
      motivo: "TRANSPORTE_SEM_RESPOSTA",
    };
  }

  if (!response.ok) {
    // HTTP com erro não comprova que o estorno
    // deixou de ser executado pelo provedor.
    return {
        ...resultadoBase,
        resultado: "DESCONHECIDO",
        estornoProviderRef: null,
        statusHttp: response.status,
        motivo:
        "HTTP_INCONCLUSIVO_REQUER_CONCILIACAO",
    };
    }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return {
      ...resultadoBase,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: response.status,
      motivo: "RESPOSTA_JSON_INVALIDA",
    };
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      ...resultadoBase,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: response.status,
      motivo: "RESPOSTA_FORA_DO_CONTRATO",
    };
  }

  const data = body as Record<string, unknown>;

  const estornoProviderRef =
    data.id == null
      ? ""
      : String(data.id);

  const pagamentoRetornado =
    data.payment_id == null
      ? ""
      : String(data.payment_id);

  const valor =
    data.amount;

  const valorValido =
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    new Prisma.Decimal(valor)
      .mul(100)
      .equals(
        args.valorEsperadoCentavos
      );

  if (
    !/^\d+$/.test(estornoProviderRef) ||
    pagamentoRetornado !==
      args.pagamentoProviderRef ||
    !valorValido
  ) {
    return {
      ...resultadoBase,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: response.status,
      motivo: "EVIDENCIA_EXTERNA_DIVERGENTE",
    };
  }

  if (data.status !== "approved") {
    return {
      ...resultadoBase,
      resultado: "NAO_CONFIRMADO",
      estornoProviderRef,
      statusHttp: response.status,
      motivo: "ESTORNO_AINDA_NAO_APROVADO",
    };
  }

  return {
    ...resultadoBase,
    resultado: "CONFIRMADO",
    estornoProviderRef,
    statusHttp: response.status,
    motivo: "RESPOSTA_APROVADA",
  };
}

export async function executarPostEstornoAutorizadoMercadoPago(
  args: {
    pagamentoId: string;
    tentativaId: string;
    pagamentoProviderRef: string;
    chaveIdempotencia: string;
    valorEsperadoCentavos: number;
  }
): Promise<ResultadoTransporteEstorno> {
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
      "BILLING_POST_ESTORNO_REAL_BLOQUEADO"
    );
  }

  const uuid =
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  if (
    !uuid.test(args.pagamentoId) ||
    !uuid.test(args.tentativaId) ||
    !/^\d+$/.test(args.pagamentoProviderRef) ||
    args.chaveIdempotencia !==
      `footera-evento-refund-${args.pagamentoId}` ||
    !Number.isSafeInteger(args.valorEsperadoCentavos) ||
    args.valorEsperadoCentavos <= 0
  ) {
    throw new Error(
      "BILLING_POST_ESTORNO_ARGUMENTOS_INVALIDOS"
    );
  }

  // A autorização será consumida antes do POST.
  // A transação NÃO inclui nenhuma chamada HTTP.
  const autorizada = await prisma.$transaction(
    async (tx) => {
      const compensacao =
        await tx.billingCompensacaoEvento.findUnique({
          where: {
            pagamentoId: args.pagamentoId,
          },
          include: {
            pagamento: true,
            pendencia: true,
            historicoTentativas: true,
          },
        });

      const tentativa =
        compensacao?.historicoTentativas[0];

      if (
        !compensacao ||
        compensacao.status !==
          "AGUARDANDO_CONFIRMACAO" ||
        compensacao.tentativas !== 1 ||
        compensacao.confirmadoEm !== null ||
        compensacao.historicoTentativas.length !== 1 ||
        !tentativa ||
        tentativa.id !== args.tentativaId ||
        tentativa.compensacaoId !== compensacao.id ||
        tentativa.numero !== 1 ||
        tentativa.ambiente !== "REAL" ||
        tentativa.status !==
          "CONFIRMACAO_EXTERNA_PENDENTE" ||
        tentativa.requisicaoEnviadaEm === null ||
        tentativa.postAutorizacaoConsumidaEm !== null ||
        tentativa.estornoProviderRef !== null ||
        tentativa.operacaoExternaExecutada !== false ||
        tentativa.chaveIdempotenciaOperacao !==
          args.chaveIdempotencia ||
        compensacao.chaveIdempotencia !==
          args.chaveIdempotencia ||
        compensacao.providerRef !==
          args.pagamentoProviderRef ||
        compensacao.moeda !== "BRL" ||
        !compensacao.valor
          .mul(100)
          .equals(args.valorEsperadoCentavos) ||
        compensacao.pagamento.id !==
          args.pagamentoId ||
        compensacao.pagamento.provider !==
          "MERCADOPAGO" ||
        compensacao.pagamento.providerRef !==
          args.pagamentoProviderRef ||
        compensacao.pagamento.status !== "PENDENTE" ||
        compensacao.pagamento.reembolsadoEm !== null ||
        compensacao.pagamento.moeda !== "BRL" ||
        !compensacao.pagamento.valor.equals(
          compensacao.valor
        ) ||
        compensacao.pagamento.plano !==
          `EVENTO:${compensacao.pendencia.eventoId}` ||
        compensacao.pendencia.pagamentoId !==
          args.pagamentoId ||
        compensacao.pendencia.providerRef !==
          args.pagamentoProviderRef ||
        compensacao.pendencia.motivo !==
          "BILLING_EVENT_CAPACITY_EXCEEDED" ||
        !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
          compensacao.pendencia.status
        ) ||
        compensacao.pendencia.resolvidoEm !== null ||
        !compensacao.pendencia.valor.equals(
          compensacao.valor
        ) ||
        compensacao.pendencia.moeda !== "BRL"
      ) {
        return false;
      }

      const beneficios =
        await tx.pagamentoBeneficio.count({
          where: { pagamentoId: args.pagamentoId },
        });

      const inscricoes =
        await tx.inscricaoEvento.count({
          where: {
            eventoId: compensacao.pendencia.eventoId,
            usuarioId: compensacao.pagamento.usuarioId,
            status: { not: "CANCELADA" },
          },
        });

      if (beneficios !== 0 || inscricoes !== 0) {
        return false;
      }

      const autorizacaoAdmin =
        await tx.billingAutorizacaoEstorno.findUnique({
          where: {
            pagamentoId: args.pagamentoId,
          },
        });

      if (
        !autorizacaoAdmin ||
        autorizacaoAdmin.status !== "CONSUMIDA" ||
        !autorizacaoAdmin.consumidoEm ||
        !autorizacaoAdmin.aprovadoEm ||
        !autorizacaoAdmin.aprovadorId ||
        autorizacaoAdmin.solicitanteId ===
          autorizacaoAdmin.aprovadorId ||
        autorizacaoAdmin.moeda !== "BRL" ||
        autorizacaoAdmin.providerRef !==
          args.pagamentoProviderRef ||
        !autorizacaoAdmin.valor
          .mul(100)
          .equals(args.valorEsperadoCentavos)
      ) {
        return false;
      }
      // Apenas uma chamada concorrente pode
      // transformar NULL em data.
      const consumida =
        await tx.billingCompensacaoTentativa.updateMany({
          where: {
            id: tentativa.id,
            compensacaoId: compensacao.id,
            ambiente: "REAL",
            numero: 1,
            status:
              "CONFIRMACAO_EXTERNA_PENDENTE",
            chaveIdempotenciaOperacao:
              args.chaveIdempotencia,
            requisicaoEnviadaEm: { not: null },
            postAutorizacaoConsumidaEm: null,
            estornoProviderRef: null,
            operacaoExternaExecutada: false,
            compensacao: {
              is: {
                status: "AGUARDANDO_CONFIRMACAO",
                tentativas: 1,
                confirmadoEm: null,
              },
            },
          },
          data: {
            postAutorizacaoConsumidaEm: new Date(),
            observacao:
              "Autorização do POST consumida. " +
              "Resultado financeiro ainda desconhecido.",
          },
        });

      return consumida.count === 1;
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 15000,
    }
  );

  if (!autorizada) {
    throw new Error(
      "BILLING_POST_ESTORNO_AUTORIZACAO_NAO_ADQUIRIDA"
    );
  }

  // A autorização já foi persistida.
  // Daqui em diante, uma falha não libera novo POST.
  const base = {
    pagamentoProviderRef: args.pagamentoProviderRef,
  };

  let resposta: Response;

  try {
    resposta = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        args.pagamentoProviderRef
      )}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "X-Idempotency-Key":
            args.chaveIdempotencia,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      }
    );
  } catch {
    return {
      ...base,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: null,
      motivo: "TRANSPORTE_SEM_RESPOSTA",
    };
  }

  if (!resposta.ok) {
    return {
      ...base,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: resposta.status,
      motivo: "HTTP_REQUER_CONCILIACAO",
    };
  }

  let dados: unknown;

  try {
    dados = await resposta.json();
  } catch {
    return {
      ...base,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: resposta.status,
      motivo: "RESPOSTA_INVALIDA",
    };
  }

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    return {
      ...base,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: resposta.status,
      motivo: "RESPOSTA_FORA_DO_CONTRATO",
    };
  }

  const resultado = dados as Record<string, unknown>;

  const estornoProviderRef =
    String(resultado.id ?? "");

  const pagamentoRetornado =
    String(resultado.payment_id ?? "");

  let valorValido = false;

  try {
    valorValido =
      resultado.amount != null &&
      new Prisma.Decimal(
        String(resultado.amount)
      )
        .mul(100)
        .equals(args.valorEsperadoCentavos);
  } catch {
    valorValido = false;
  }

  if (
    !/^\d+$/.test(estornoProviderRef) ||
    pagamentoRetornado !==
      args.pagamentoProviderRef ||
    !valorValido ||
    resultado.status !== "approved"
  ) {
    return {
      ...base,
      resultado: "DESCONHECIDO",
      estornoProviderRef: null,
      statusHttp: resposta.status,
      motivo: "EVIDENCIA_EXTERNA_NAO_CONFIRMADA",
    };
  }

  return {
    ...base,
    resultado: "CONFIRMADO",
    estornoProviderRef,
    statusHttp: resposta.status,
    motivo: "RESPOSTA_APROVADA_REQUER_GET",
  };
}

export async function solicitarEstornoMercadoPago():
  Promise<never> {
  throw new Error(
    "BILLING_ESTORNO_ENVIO_REAL_DESABILITADO"
  );
}