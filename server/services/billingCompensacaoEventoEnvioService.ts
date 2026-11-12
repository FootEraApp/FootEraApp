
import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import {
  prepararCompensacaoEventoVerificada,
} from "./billingCompensacaoEventoVerificadaService.js";
import {
  consultarEvidenciaEstornoMercadoPago,
  testarTransporteEstornoMercadoPagoQa,
  executarPostEstornoAutorizadoMercadoPago,
} from "./billingEstornoMercadoPagoGateway.js";
import {
  finalizarCompensacaoEventoVerificada,
} from "./billingCompensacaoEventoFinalizacaoService.js";
import {
  iniciarTentativaCompensacaoQa,
  reservarChaveOperacaoCompensacaoQa,
  registrarIntencaoEnvioEstornoQa,
  avaliarRetomadaCompensacaoQa,
} from "./billingCompensacaoEventoTentativaQaService.js";
import {
  consultarEstornosPagamentoMercadoPago,
} from "./billingConciliacaoMercadoPagoService.js";
import {
  validarExecutorEstorno,
  consumirAutorizacaoEstornoNaAquisicao,
  validarAutorizacaoEstornoAntesDoPreparo,
} from "./billingEstornoAdministrativoService.js";

function validarAmbienteEnvioQa(): void {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error(
      "BILLING_ENVIO_QA_DATABASE_URL_INVALIDA"
    );
  }

  const permitido =
    process.env.NODE_ENV === "test" &&
    !process.env.MP_ACCESS_TOKEN &&
    process.env.BILLING_CUPOM_RESERVA_QA === "true" &&
    process.env.ENABLE_BILLING_SCHEDULER === "false" &&
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false" &&
    db.protocol === "postgresql:" &&
    ["127.0.0.1", "localhost"].includes(db.hostname) &&
    db.port === "5433" &&
    db.pathname === "/footera_billing_qa";

  if (!permitido) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_QA_DISABLED"
    );
  }
}

async function validarBancoRealQa(): Promise<void> {
  validarAmbienteEnvioQa();

  const resultado = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  if (resultado[0]?.nome !== "footera_billing_qa") {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_BANCO_INCORRETO"
    );
  }
}

function validarPagamentoId(pagamentoId: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pagamentoId
    )
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_PAGAMENTO_INVALIDO"
    );
  }
}

/**
 * Prepara, adquire, reserva e registra intenção.
 *
 * Não executar duas vezes para tentar novamente
 * um envio externo.
 *
 * As funções internas fazem aquisição condicional.
 * Se qualquer etapa falhar, nenhuma chamada externa
 * será feita e a situação deverá ser conciliada.
 */
export async function prepararIntencaoEnvioEstornoQa(
  pagamentoId: string
) {
  await validarBancoRealQa();
  validarPagamentoId(pagamentoId);

  const preparada =
    await prepararCompensacaoEventoVerificada(
      pagamentoId
    );

  if (
    preparada.compensacao.pagamentoId !== pagamentoId
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_PREPARACAO_DIVERGENTE"
    );
  }

  const aquisicao =
    await iniciarTentativaCompensacaoQa(pagamentoId);

  if (!aquisicao.adquirida) {
    const retomada =
      await avaliarRetomadaCompensacaoQa(pagamentoId);

    return {
      pagamentoId,
      executouEstorno: false,
      intencaoRegistrada: false,
      requerConciliacao: true,
      motivo: "TENTATIVA_JA_EXISTENTE",
      retomada,
    };
  }

  const reserva =
    await reservarChaveOperacaoCompensacaoQa(
      pagamentoId
    );

  if (!reserva.reservada) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_RESERVA_NAO_CONFIRMADA"
    );
  }

  const chaveEsperada =
    `footera-evento-refund-${pagamentoId}`;

  if (reserva.chaveIdempotencia !== chaveEsperada) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_CHAVE_DIVERGENTE"
    );
  }

  const intencao =
    await registrarIntencaoEnvioEstornoQa(
      pagamentoId
    );

  if (!intencao.registrada) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_INTENCAO_NAO_CONFIRMADA"
    );
  }

  if (
    intencao.chaveIdempotencia !== chaveEsperada ||
    intencao.operacaoExternaExecutada !== false
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_ESTADO_INVALIDO"
    );
  }

  const retomada =
    await avaliarRetomadaCompensacaoQa(
      pagamentoId
    );

  if (
    retomada.motivo !==
      "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO" ||
    retomada.podeEnviarEstorno !== false ||
    retomada.podeRepetirEstorno !== false
  ) {
    throw new Error(
      "BILLING_COMPENSACAO_ENVIO_RETOMADA_INCONSISTENTE"
    );
  }

  return {
    pagamentoId,
    compensacaoId: intencao.compensacaoId,
    tentativaId: intencao.tentativaId,
    chaveIdempotencia: chaveEsperada,

    intencaoRegistrada: true,
    executouEstorno: false,
    requerConciliacao: true,

    motivo: "INTENCAO_QA_REGISTRADA_SEM_ENVIO",
    retomada,
  };
}

/**
 * Consulta o estado da compensação em QA.
 *
 * Apenas observação.
 * Nunca reenvia um estorno.
 */
export async function consultarRetomadaEnvioEstornoQa(
  pagamentoId: string
) {
  await validarBancoRealQa();
  validarPagamentoId(pagamentoId);

  const retomada =
    await avaliarRetomadaCompensacaoQa(
      pagamentoId
    );

  return {
    ...retomada,
    executarNovoEstorno: false,
    atualizarPagamento: false,
    confirmarCompensacao: false,
  };
}

function validarAmbienteEstornoReal(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BILLING_CUPOM_RESERVA_QA === "true" ||
    !process.env.MP_ACCESS_TOKEN ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "true" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "true" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "true"
  ) {
    throw new Error(
      "BILLING_ESTORNO_REAL_DESABILITADO"
    );
  }
}

function validarAmbienteConsultaEstornoReal(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BILLING_CUPOM_RESERVA_QA === "true" ||
    !process.env.MP_ACCESS_TOKEN
  ) {
    throw new Error(
      "BILLING_CONSULTA_ESTORNO_REAL_INDISPONIVEL"
    );
  }
}

export async function prepararEnvioEstornoReal(
  pagamentoId: string
) {
  validarAmbienteEstornoReal();
  validarPagamentoId(pagamentoId);

  // Comprova previamente que o pagamento externo
  // está elegível à compensação.
  // Não envia estorno ao Mercado Pago.
  const preparada =
    await prepararCompensacaoEventoVerificada(
      pagamentoId
    );

  if (
    preparada.compensacao.pagamentoId !== pagamentoId ||
    preparada.compensacao.status !== "PREPARADA"
  ) {
    throw new Error(
      "BILLING_ESTORNO_PREPARACAO_REAL_INVALIDA"
    );
  }

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  if (
    !banco[0]?.nome ||
    banco[0].nome === "footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_ESTORNO_REAL_BANCO_INVALIDO"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const bloqueio = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${pagamentoId}
        FOR UPDATE
      `;

      if (bloqueio.length !== 1) {
        throw new Error(
          "BILLING_ESTORNO_PAGAMENTO_AUSENTE"
        );
      }

      const c =
        await tx.billingCompensacaoEvento.findUnique({
          where: { pagamentoId },
          include: {
            pagamento: true,
            pendencia: true,
            historicoTentativas: true,
          },
        });

      if (!c) {
        throw new Error(
          "BILLING_ESTORNO_COMPENSACAO_AUSENTE"
        );
      }

      const chave =
        `footera-evento-refund-${pagamentoId}`;

      const valorCentavos =
        c.valor.mul(100).toNumber();

      if (
        c.status !== "PREPARADA" ||
        c.tentativas !== 0 ||
        c.confirmadoEm !== null ||
        c.historicoTentativas.length !== 0 ||
        c.chaveIdempotencia !== chave ||
        c.pagamento.id !== pagamentoId ||
        c.pagamento.status !== "PENDENTE" ||
        c.pagamento.reembolsadoEm !== null ||
        c.pagamento.provider !== "MERCADOPAGO" ||
        c.pagamento.providerRef !== c.providerRef ||
        !/^\d+$/.test(c.providerRef) ||
        c.pagamento.plano !==
          `EVENTO:${c.pendencia.eventoId}` ||
        c.pendencia.pagamentoId !== pagamentoId ||
        c.pendencia.providerRef !== c.providerRef ||
        !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
        c.pendencia.status
        ) ||
        c.pendencia.resolvidoEm !== null ||
        c.pendencia.motivo !==
          "BILLING_EVENT_CAPACITY_EXCEEDED" ||
        c.moeda !== "BRL" ||
        c.pagamento.moeda !== "BRL" ||
        c.pendencia.moeda !== "BRL" ||
        !c.pagamento.valor.equals(c.valor) ||
        !c.pendencia.valor.equals(c.valor) ||
        !Number.isSafeInteger(valorCentavos) ||
        valorCentavos <= 0
      ) {
        throw new Error(
          "BILLING_ESTORNO_ESTADO_NAO_PERMITE_ENVIO"
        );
      }

      const beneficios =
        await tx.pagamentoBeneficio.count({
          where: { pagamentoId },
        });

      const inscricoes =
        await tx.inscricaoEvento.count({
          where: {
            eventoId: c.pendencia.eventoId,
            usuarioId: c.pagamento.usuarioId,
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
          "BILLING_ESTORNO_ACESSO_EXISTENTE"
        );
      }

      const adquirido =
        await tx.billingCompensacaoEvento.updateMany({
          where: {
            id: c.id,
            status: "PREPARADA",
            tentativas: 0,
            confirmadoEm: null,
          },
          data: {
            status: "AGUARDANDO_CONFIRMACAO",
            tentativas: 1,
            ultimoErro: null,
          },
        });

      if (adquirido.count !== 1) {
        throw new Error(
          "BILLING_ESTORNO_AQUISICAO_CONCORRENTE"
        );
      }

      const tentativa =
        await tx.billingCompensacaoTentativa.create({
          data: {
            compensacaoId: c.id,
            numero: 1,
            status: "CONFIRMACAO_EXTERNA_PENDENTE",
            ambiente: "REAL",
            operacaoExternaExecutada: false,
            chaveIdempotenciaOperacao: chave,
            estornoProviderRef: null,
            requisicaoEnviadaEm: null,
            observacao:
              "Intenção real persistida. " +
              "Resultado externo ainda não confirmado.",
          },
        });

      return {
        pagamentoId,
        compensacaoId: c.id,
        tentativaId: tentativa.id,
        pagamentoProviderRef: c.providerRef,
        chaveIdempotencia: chave,
        valorCentavos,
        moeda: c.moeda,
        intencaoPersistida: true,
        envioExternoExecutado: false,
        requerConciliacao: true,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function consultarRetomadaEstornoReal(
  pagamentoId: string
) {
  validarAmbienteConsultaEstornoReal();
  validarPagamentoId(pagamentoId);

  const c =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: {
        historicoTentativas: {
          orderBy: { numero: "desc" },
          take: 2,
        },
      },
    });

  if (!c) {
    throw new Error(
      "BILLING_ESTORNO_COMPENSACAO_AUSENTE"
    );
  }

  const tentativa =
    c.historicoTentativas[0];

  const historicoValido =
    c.tentativas === 1 &&
    c.historicoTentativas.length === 1 &&
    tentativa?.numero === 1 &&
    tentativa?.ambiente === "REAL" &&
    tentativa.compensacaoId === c.id &&
    tentativa.chaveIdempotenciaOperacao ===
      c.chaveIdempotencia;

  return {
    pagamentoId,
    compensacaoId: c.id,
    statusCompensacao: c.status,
    statusTentativa: tentativa?.status ?? null,
    historicoValido,
    tentativaId: tentativa?.id ?? null,
    chaveIdempotencia:
      tentativa?.chaveIdempotenciaOperacao ?? null,
    estornoProviderRef:
      tentativa?.estornoProviderRef ?? null,
    requisicaoEnviadaEm:
      tentativa?.requisicaoEnviadaEm ?? null,
    operacaoExternaExecutada:
      tentativa?.operacaoExternaExecutada ?? false,

    // Reentrada é sempre somente leitura.
    podeEnviarNovoEstorno: false,
    podeRepetirEstorno: false,

    requerConciliacao:
      c.status !== "CONFIRMADA",
  };
}

type ModoAquisicaoEstorno = "REAL" | "QA";

async function executarAquisicaoEnvioEstorno(
  pagamentoId: string,
  modo: ModoAquisicaoEstorno,
  executorId?: string
) {
  if (modo === "QA") {
    await validarBancoRealQa();
  } else {
    validarAmbienteEstornoReal();

    if (!executorId) {
      throw new Error(
        "BILLING_ESTORNO_EXECUTOR_OBRIGATORIO"
      );
    }

    await validarExecutorEstorno(executorId);
  }

  validarPagamentoId(pagamentoId);

  return prisma.$transaction(
    async (tx) => {
      const bloqueio = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${pagamentoId}
        FOR UPDATE
      `;

      if (bloqueio.length !== 1) {
        throw new Error(
          "BILLING_ENVIO_PAGAMENTO_AUSENTE"
        );
      }

      const c =
        await tx.billingCompensacaoEvento.findUnique({
          where: { pagamentoId },
          include: {
            pagamento: true,
            pendencia: true,
            historicoTentativas: true,
          },
        });

      if (!c) {
        throw new Error(
          "BILLING_ENVIO_COMPENSACAO_AUSENTE"
        );
      }

      const tentativa =
        c.historicoTentativas[0];

      const chaveEsperada =
        `footera-evento-refund-${pagamentoId}`;

      const centavos =
        c.valor.mul(100).toNumber();

      if (
        c.status !== "AGUARDANDO_CONFIRMACAO" ||
        c.confirmadoEm !== null ||
        c.tentativas !== 1 ||
        c.historicoTentativas.length !== 1 ||
        c.chaveIdempotencia !== chaveEsperada ||
        !tentativa ||
        tentativa.compensacaoId !== c.id ||
        tentativa.numero !== 1 ||
        tentativa.ambiente !== modo ||
        tentativa.status !==
          "CONFIRMACAO_EXTERNA_PENDENTE" ||
        tentativa.chaveIdempotenciaOperacao !==
          chaveEsperada ||
        tentativa.requisicaoEnviadaEm !== null ||
        tentativa.estornoProviderRef !== null ||
        tentativa.operacaoExternaExecutada !== false ||
        c.pagamento.id !== pagamentoId ||
        c.pagamento.status !== "PENDENTE" ||
        c.pagamento.reembolsadoEm !== null ||
        c.pagamento.provider !== "MERCADOPAGO" ||
        c.pagamento.providerRef !== c.providerRef ||
        !/^\d+$/.test(c.providerRef) ||
        c.pagamento.plano !==
          `EVENTO:${c.pendencia.eventoId}` ||
        c.pendencia.pagamentoId !== pagamentoId ||
        c.pendencia.providerRef !== c.providerRef ||
        c.pendencia.resolvidoEm !== null ||
        !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
          c.pendencia.status
        ) ||
        c.pendencia.motivo !==
          "BILLING_EVENT_CAPACITY_EXCEEDED" ||
        c.moeda !== "BRL" ||
        c.pagamento.moeda !== "BRL" ||
        c.pendencia.moeda !== "BRL" ||
        !c.pagamento.valor.equals(c.valor) ||
        !c.pendencia.valor.equals(c.valor) ||
        !Number.isSafeInteger(centavos) ||
        centavos <= 0
      ) {
        return {
          pagamentoId,
          adquirida: false as const,
          motivo:
            "TENTATIVA_JA_INICIADA_OU_ESTADO_INVALIDO",
        };
      }

      const beneficios =
        await tx.pagamentoBeneficio.count({
          where: { pagamentoId },
        });

      const inscricoes =
        await tx.inscricaoEvento.count({
          where: {
            eventoId: c.pendencia.eventoId,
            usuarioId: c.pagamento.usuarioId,
            status: { not: "CANCELADA" },
          },
        });

      if (beneficios !== 0 || inscricoes !== 0) {
        throw new Error(
          "BILLING_ENVIO_ACESSO_FINANCEIRO_EXISTENTE"
        );
      }

      const instante = new Date();

      const adquirido =
        await tx.billingCompensacaoTentativa.updateMany({
          where: {
            id: tentativa.id,
            compensacaoId: c.id,
            numero: 1,
            ambiente: modo,
            status: "CONFIRMACAO_EXTERNA_PENDENTE",
            chaveIdempotenciaOperacao: chaveEsperada,
            requisicaoEnviadaEm: null,
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
            requisicaoEnviadaEm: instante,
            observacao:
              "Direito de envio adquirido. " +
              "Resultado externo ainda desconhecido.",
          },
        });

      if (adquirido.count !== 1) {
        return {
          pagamentoId,
          adquirida: false as const,
          motivo: "ENVIO_JA_ADQUIRIDO",
        };
      }

      if (modo === "REAL") {
        if (!executorId) {
          throw new Error(
            "BILLING_ESTORNO_EXECUTOR_OBRIGATORIO"
          );
        }

        await consumirAutorizacaoEstornoNaAquisicao(
          tx,
          pagamentoId,
          c.valor,
          c.providerRef,
          executorId
        );
      }

      return {
        pagamentoId,
        adquirida: true as const,
        tentativaId: tentativa.id,
        pagamentoProviderRef: c.providerRef,
        chaveIdempotencia: chaveEsperada,
        valorCentavos: centavos,
        moeda: c.moeda,
        requisicaoEnviadaEm: instante,
        motivo: "ENVIO_ADQUIRIDO_SEM_HTTP",
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function adquirirExecucaoEnvioEstornoReal(
  pagamentoId: string,
  executorId: string
) {
  return executarAquisicaoEnvioEstorno(
    pagamentoId,
    "REAL",
    executorId
  );
}

export async function adquirirExecucaoEnvioEstornoQa(
  pagamentoId: string
) {
  await validarBancoRealQa();

  return executarAquisicaoEnvioEstorno(
    pagamentoId,
    "QA"
  );
}


type ModoRegistroEstorno = "REAL" | "QA";

type EvidenciaEstornoValidada = {
  pagamentoProviderRef: string;
  estornoProviderRef: string;
  valor: Prisma.Decimal | string | number;
  moeda: string;
  status: string;
};

async function persistirResultadoEstornoConfirmado(
  pagamentoId: string,
  estornoProviderRef: string,
  modo: ModoRegistroEstorno,
  verificarEvidencia: (args: {
    pagamentoProviderRef: string;
    estornoProviderRef: string;
    valorEsperado: Prisma.Decimal;
    moeda: string;
  }) => Promise<EvidenciaEstornoValidada>
) {
  if (modo === "QA") {
    await validarBancoRealQa();
  } else {
    validarAmbienteConsultaEstornoReal();
  }

  validarPagamentoId(pagamentoId);

  if (!/^\d+$/.test(estornoProviderRef)) {
    throw new Error(
      "BILLING_RESULTADO_ESTORNO_REF_INVALIDA"
    );
  }

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
    });

  if (!compensacao) {
    throw new Error(
      "BILLING_RESULTADO_COMPENSACAO_AUSENTE"
    );
  }

  // A verificação acontece ANTES da transação.
  // Nenhum HTTP é executado dentro do FOR UPDATE.
  const evidencia = await verificarEvidencia({
    pagamentoProviderRef: compensacao.providerRef,
    estornoProviderRef,
    valorEsperado: compensacao.valor,
    moeda: compensacao.moeda,
  });

  // A resposta do verificador também é validada
  // por este núcleo, independentemente do modo.
  if (
    evidencia.pagamentoProviderRef !==
      compensacao.providerRef ||
    evidencia.estornoProviderRef !==
      estornoProviderRef ||
    evidencia.status !== "approved" ||
    evidencia.moeda !== "BRL" ||
    compensacao.moeda !== "BRL" ||
    !new Prisma.Decimal(evidencia.valor).equals(
      compensacao.valor
    )
  ) {
    throw new Error(
      "BILLING_RESULTADO_EVIDENCIA_DIVERGENTE"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const bloqueio = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${pagamentoId}
        FOR UPDATE
      `;

      if (bloqueio.length !== 1) {
        throw new Error(
          "BILLING_RESULTADO_PAGAMENTO_AUSENTE"
        );
      }

      const atual =
        await tx.billingCompensacaoEvento.findUniqueOrThrow({
          where: { pagamentoId },
          include: {
            pagamento: true,
            pendencia: true,
            historicoTentativas: true,
          },
        });

      const tentativa =
        atual.historicoTentativas[0];

      const chaveEsperada =
        `footera-evento-refund-${pagamentoId}`;

      // A evidência obtida anteriormente não pode
      // ser aplicada a uma compensação que mudou.
      if (
        atual.providerRef !==
          compensacao.providerRef ||
        !atual.valor.equals(compensacao.valor) ||
        atual.moeda !== compensacao.moeda ||
        atual.chaveIdempotencia !== chaveEsperada ||
        atual.historicoTentativas.length !== 1 ||
        !tentativa ||
        tentativa.numero !== 1 ||
        tentativa.compensacaoId !== atual.id ||
        tentativa.ambiente !== modo ||
        tentativa.chaveIdempotenciaOperacao !==
          chaveEsperada ||
        atual.pagamento.id !== pagamentoId ||
        atual.pagamento.provider !== "MERCADOPAGO" ||
        atual.pagamento.providerRef !==
          atual.providerRef ||
        atual.pagamento.plano !==
          `EVENTO:${atual.pendencia.eventoId}` ||
        atual.pendencia.pagamentoId !== pagamentoId ||
        atual.pendencia.providerRef !==
          atual.providerRef ||
        atual.pendencia.motivo !==
          "BILLING_EVENT_CAPACITY_EXCEEDED" ||
        !atual.pagamento.valor.equals(atual.valor) ||
        !atual.pendencia.valor.equals(atual.valor) ||
        atual.pagamento.moeda !== "BRL" ||
        atual.pendencia.moeda !== "BRL"
      ) {
        throw new Error(
          "BILLING_RESULTADO_ESTADO_INCOMPATIVEL"
        );
      }

      // Permite consultar novamente a mesma evidência
      // antes da finalização.
      if (
        atual.status === "AGUARDANDO_CONFIRMACAO" &&
        atual.tentativas === 1 &&
        atual.confirmadoEm === null &&
        tentativa.status ===
          "CONFIRMACAO_EXTERNA_PENDENTE" &&
        tentativa.estornoProviderRef ===
          estornoProviderRef &&
        tentativa.requisicaoEnviadaEm !== null &&
        tentativa.operacaoExternaExecutada === true &&
        atual.pagamento.status === "PENDENTE" &&
        atual.pagamento.reembolsadoEm === null
      ) {
        return {
          pagamentoId,
          estornoProviderRef,
          registrada: true,
          idempotente: true,
        };
      }

      if (
        atual.status !== "AGUARDANDO_CONFIRMACAO" ||
        atual.confirmadoEm !== null ||
        atual.tentativas !== 1 ||
        tentativa.status !== "CONFIRMACAO_EXTERNA_PENDENTE" ||
        tentativa.requisicaoEnviadaEm === null ||
        tentativa.estornoProviderRef !== null ||
        tentativa.operacaoExternaExecutada !== false ||
        atual.pagamento.status !== "PENDENTE" ||
        atual.pagamento.reembolsadoEm !== null ||
        atual.pendencia.resolvidoEm !== null ||
        !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
          atual.pendencia.status
        )
      ) {
        throw new Error(
          "BILLING_RESULTADO_ESTADO_INCOMPATIVEL"
        );
      }

      const atualizado =
        await tx.billingCompensacaoTentativa.updateMany({
          where: {
            id: tentativa.id,
            compensacaoId: atual.id,
            numero: 1,
            ambiente: modo,
            status: "CONFIRMACAO_EXTERNA_PENDENTE",
            chaveIdempotenciaOperacao: chaveEsperada,
            requisicaoEnviadaEm: { not: null },
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
            estornoProviderRef,
            operacaoExternaExecutada: true,
            observacao:
              modo === "QA"
                ? "QA: evidência simulada validada; nenhum estorno externo."
                : "Estorno comprovado por consulta externa.",
          },
        });

      if (atualizado.count !== 1) {
        throw new Error(
          "BILLING_RESULTADO_REGISTRO_CONCORRENTE"
        );
      }

      return {
        pagamentoId,
        estornoProviderRef,
        registrada: true,
        idempotente: false,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

/**
 * Produção: somente evidência consultada
 * diretamente no Mercado Pago.
 *
 * Nunca confia em dados de evidência recebidos
 * de um cliente HTTP ou de uma rota pública.
 */
export async function registrarResultadoEnvioEstornoReal(
  pagamentoId: string,
  estornoProviderRef: string
) {
  validarAmbienteConsultaEstornoReal();

  return persistirResultadoEstornoConfirmado(
    pagamentoId,
    estornoProviderRef,
    "REAL",
    async (args) => {
      return consultarEvidenciaEstornoMercadoPago(args);
    }
  );
}

/**
 * QA: permite testar o mesmo núcleo transacional
 * com uma evidência inteiramente simulada.
 *
 * Não consulta o Mercado Pago.
 * Não envia POST.
 * Não finaliza compensação.
 *
 * Só funciona no banco footera_billing_qa.
 */
export async function registrarResultadoEnvioEstornoQa(
  pagamentoId: string,
  estornoProviderRef: string,
  evidenciaSimulada: EvidenciaEstornoValidada
) {
  await validarBancoRealQa();

  return persistirResultadoEstornoConfirmado(
    pagamentoId,
    estornoProviderRef,
    "QA",
    async () => evidenciaSimulada
  );
}

export async function conciliarEstornoReal(
  pagamentoId: string
) {
  validarAmbienteConsultaEstornoReal();
  validarPagamentoId(pagamentoId);

  const retomada =
    await consultarRetomadaEstornoReal(pagamentoId);

  if (!retomada.historicoValido) {
    throw new Error(
      "BILLING_CONCILIACAO_HISTORICO_INVALIDO"
    );
  }

  if (
    retomada.statusCompensacao === "CONFIRMADA" &&
    retomada.operacaoExternaExecutada === true &&
    retomada.estornoProviderRef
  ) {
    const finalizada =
      await finalizarCompensacaoEventoVerificada(
        pagamentoId
      );

    return {
      pagamentoId,
      motivo: "COMPENSACAO_JA_CONFIRMADA",
      finalizada,
    };
  }

  if (!retomada.requisicaoEnviadaEm) {
    return {
      pagamentoId,
      motivo: "ENVIO_AINDA_NAO_INICIADO",
      requerConciliacao: true,
      podeReenviar: false,
    };
  }

  if (!retomada.estornoProviderRef) {
    const investigacao =
        await investigarEstornoSemReferenciaReal(
        pagamentoId
        );

    return {
        pagamentoId,
        motivo:
        "REFERENCIA_EXTERNA_DESCONHECIDA_REVISAO",
        requerConciliacao: true,
        podeReenviar: false,
        investigacao,
    };
    }
    
    if (!retomada.operacaoExternaExecutada) {
    await registrarResultadoEnvioEstornoReal(
        pagamentoId,
        retomada.estornoProviderRef
    );
    }

    const finalizada =
    await finalizarCompensacaoEventoVerificada(
        pagamentoId
    );

  return {
    pagamentoId,
    motivo: "ESTORNO_CONFIRMADO",
    requerConciliacao: false,
    podeReenviar: false,
    finalizada,
  };
}


type EstornoParaInvestigacao = {
  id?: string | number | null;
  payment_id?: string | number | null;
  amount?: string | number | null;
  status?: string | null;
  date_created?: string | null;
};

export function classificarEstornosParaInvestigacao(
  pagamentoProviderRef: string,
  valorEsperado: Prisma.Decimal | string | number,
  estornos: readonly EstornoParaInvestigacao[]
) {
  if (!/^\d+$/.test(pagamentoProviderRef)) {
    throw new Error(
      "BILLING_INVESTIGACAO_PAGAMENTO_INVALIDO"
    );
  }

  const valor = new Prisma.Decimal(valorEsperado);

  if (
    !valor.isFinite() ||
    valor.lessThanOrEqualTo(0) ||
    !valor.mul(100).isInteger()
  ) {
    throw new Error(
      "BILLING_INVESTIGACAO_VALOR_INVALIDO"
    );
  }

  const candidatos = estornos.filter((estorno) => {
    if (
      String(estorno.payment_id ?? "") !==
        pagamentoProviderRef ||
      !/^\d+$/.test(String(estorno.id ?? "")) ||
      estorno.status !== "approved" ||
      estorno.amount == null
    ) {
      return false;
    }

    try {
      const valorExterno =
        new Prisma.Decimal(estorno.amount);

      return (
        valorExterno.isFinite() &&
        valorExterno.equals(valor)
      );
    } catch {
      return false;
    }
  });

  return {
    quantidadeCandidatos: candidatos.length,

    candidatos: candidatos.map((estorno) => ({
      estornoProviderRef: String(estorno.id),
      valor: estorno.amount,
      status: estorno.status,
      criadoEm: estorno.date_created ?? null,
    })),

    situacao:
      candidatos.length === 0
        ? "SEM_EVIDENCIA_CONCLUSIVA" as const
        : "CANDIDATOS_EXIGEM_REVISAO" as const,

    podeReenviar: false as const,
    podeFinalizarAutomaticamente: false as const,
  };
}

export async function investigarEstornoSemReferenciaReal(
  pagamentoId: string
) {
  validarAmbienteConsultaEstornoReal();
  validarPagamentoId(pagamentoId);

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: {
        pagamento: true,
        historicoTentativas: true,
      },
    });

  if (!compensacao) {
    throw new Error(
      "BILLING_INVESTIGACAO_COMPENSACAO_AUSENTE"
    );
  }

  const tentativa =
    compensacao.historicoTentativas[0];

  if (
    compensacao.historicoTentativas.length !== 1 ||
    compensacao.tentativas !== 1 ||
    compensacao.status !== "AGUARDANDO_CONFIRMACAO" ||
    !tentativa ||
    tentativa.ambiente !== "REAL" ||
    tentativa.numero !== 1 ||
    tentativa.requisicaoEnviadaEm === null ||
    tentativa.estornoProviderRef !== null ||
    tentativa.operacaoExternaExecutada !== false ||
    tentativa.chaveIdempotenciaOperacao !==
      `footera-evento-refund-${pagamentoId}` ||
    compensacao.pagamento.status !== "PENDENTE" ||
    compensacao.pagamento.providerRef !==
      compensacao.providerRef ||
    !/^\d+$/.test(compensacao.providerRef)
  ) {
    throw new Error(
      "BILLING_INVESTIGACAO_ESTADO_INCOMPATIVEL"
    );
  }

  const estornos =
    await consultarEstornosPagamentoMercadoPago(
      compensacao.providerRef
    );

  const classificacao =
    classificarEstornosParaInvestigacao(
        compensacao.providerRef,
        compensacao.valor,
        estornos
    );

  return {
    pagamentoId,
    compensacaoId: compensacao.id,
    tentativaId: tentativa.id,
    pagamentoProviderRef: compensacao.providerRef,
    ...classificacao,
    };
}

/**
 * Fluxo integrado QA:
 * aquisição exclusiva -> POST interceptado ->
 * validação -> persistência da evidência simulada.
 *
 * Nunca usa o token real.
 * Nunca finaliza pagamentos.
 * Nunca executa uma segunda requisição após
 * uma tentativa adquirida.
 *
 * Não registrar em controllers, rotas ou schedulers.
 */
export async function executarFluxoEstornoIntegradoQa(
  pagamentoId: string,
  fetchSimulado: typeof fetch,
  evidenciaSimulada: EvidenciaEstornoValidada
) {
  await validarBancoRealQa();
  validarPagamentoId(pagamentoId);

  if (
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true"
  ) {
    throw new Error(
      "BILLING_FLUXO_INTEGRADO_QA_INSEGURO"
    );
  }

  const aquisicao =
    await adquirirExecucaoEnvioEstornoQa(pagamentoId);

  if (!aquisicao.adquirida) {
    return {
      pagamentoId,
      adquirida: false as const,
      executouTransporte: false,
      requerConciliacao: true,
      motivo: aquisicao.motivo,
    };
  }

  // Somente a aquisição vencedora chega aqui.
  // Token fictício e fetch injetado.
  const resultado =
    await testarTransporteEstornoMercadoPagoQa({
      pagamentoProviderRef:
        aquisicao.pagamentoProviderRef,
      chaveIdempotencia:
        aquisicao.chaveIdempotencia,
      valorEsperadoCentavos:
        aquisicao.valorCentavos,
      token: "TOKEN_QA_FICTICIO",
      fetchImpl: fetchSimulado,
    });

  if (
    resultado.resultado !== "CONFIRMADO" ||
    !resultado.estornoProviderRef
  ) {
    return {
      pagamentoId,
      adquirida: true as const,
      executouTransporte: true,
      requerConciliacao: true,
      motivo: resultado.motivo,
      resultado: resultado.resultado,
      estornoProviderRef:
        resultado.estornoProviderRef,
    };
  }

  // O retorno do transporte e a evidência simulada
  // precisam identificar exatamente o mesmo estorno.
  if (
    evidenciaSimulada.estornoProviderRef !==
      resultado.estornoProviderRef ||
    evidenciaSimulada.pagamentoProviderRef !==
      aquisicao.pagamentoProviderRef ||
    evidenciaSimulada.status !== "approved" ||
    evidenciaSimulada.moeda !== aquisicao.moeda ||
    !new Prisma.Decimal(
      evidenciaSimulada.valor
    ).mul(100).equals(
      aquisicao.valorCentavos
    )
  ) {
    return {
      pagamentoId,
      adquirida: true as const,
      executouTransporte: true,
      requerConciliacao: true,
      motivo: "EVIDENCIA_SIMULADA_DIVERGENTE",
      resultado: "DESCONHECIDO" as const,
    };
  }

  const registro =
    await registrarResultadoEnvioEstornoQa(
      pagamentoId,
      resultado.estornoProviderRef,
      evidenciaSimulada
    );

  return {
    pagamentoId,
    adquirida: true as const,
    executouTransporte: true,
    requerConciliacao: false,
    motivo: "EVIDENCIA_QA_PERSISTIDA",
    resultado: resultado.resultado,
    estornoProviderRef:
      resultado.estornoProviderRef,
    registro,
  };
}

export async function executarEstornoRealControlado(
  pagamentoId: string,
  executorId: string
) {
  validarAmbienteEstornoReal();
  validarPagamentoId(pagamentoId);
  await validarExecutorEstorno(executorId);

  // Impede repetir o preparo de uma compensação
  // que já possui tentativa.
  const existente =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      select: {
        status: true,
        tentativas: true,
      },
    });

  if (existente && existente.tentativas > 0) {
    return {
      pagamentoId,
      enviado: false,
      requerConciliacao:
        existente.status !== "CONFIRMADA",
      podeReenviar: false,
      motivo:
        existente.status === "CONFIRMADA"
          ? "COMPENSACAO_JA_CONFIRMADA"
          : "TENTATIVA_EXISTENTE_SEM_REENVIO",
    };
  }

  // Bloqueia o preparo antes de criar uma tentativa
  // quando não existe aprovação administrativa válida.
  await validarAutorizacaoEstornoAntesDoPreparo(
    pagamentoId,
    executorId
  );

  await prepararEnvioEstornoReal(pagamentoId);

  const aquisicao =
    await adquirirExecucaoEnvioEstornoReal(
      pagamentoId,
      executorId
    );

  if (!aquisicao.adquirida) {
    return {
      pagamentoId,
      enviado: false,
      requerConciliacao: true,
      motivo: aquisicao.motivo,
    };
  }
  
  // A aquisição já foi persistida.
  // Qualquer falha posterior exige conciliação.
  // Nunca executar novamente o POST.
  let resposta: Awaited<
    ReturnType<
      typeof executarPostEstornoAutorizadoMercadoPago
    >
  >;

  try {    
    resposta =
    await executarPostEstornoAutorizadoMercadoPago({
        pagamentoId,
        tentativaId: aquisicao.tentativaId,
        pagamentoProviderRef:
        aquisicao.pagamentoProviderRef,
        chaveIdempotencia:
        aquisicao.chaveIdempotencia,
        valorEsperadoCentavos:
        aquisicao.valorCentavos,
    });

  } catch (erro) {
    console.error(
      "[billing] Falha após aquisição do estorno:",
      erro
    );

    return {
      pagamentoId,
      enviado: null,
      requerConciliacao: true,
      podeReenviar: false,
      motivo: "ENVIO_NAO_COMPROVADO",
    };
  }

  if (
    resposta.resultado !== "CONFIRMADO" ||
    !resposta.estornoProviderRef
  ) {
    return {
      pagamentoId,
      enviado: null,
      envioTentado: true,
      resultadoConfirmado: false,
      requerConciliacao: true,
      podeReenviar: false,
      motivo: resposta.motivo,
      resultado: resposta.resultado,
      statusHttp: resposta.statusHttp,
    };
  }

  try {
    await registrarResultadoEnvioEstornoReal(
      pagamentoId,
      resposta.estornoProviderRef
    );

    const finalizacao =
      await finalizarCompensacaoEventoVerificada(
        pagamentoId
      );

    return {
      pagamentoId,
      enviado: true,
      requerConciliacao: false,
      podeReenviar: false,
      motivo: "ESTORNO_EXTERNO_CONFIRMADO",
      finalizacao,
    };
  } catch (erro) {
    console.error(
      "[billing] Estorno enviado, mas confirmação " +
      "ou finalização permanece pendente:",
      erro
    );

    return {
      pagamentoId,
      enviado: true,
      requerConciliacao: true,
      podeReenviar: false,
      motivo:
        "ESTORNO_EXTERNO_EXIGE_CONCILIACAO",
      estornoProviderRef:
        resposta.estornoProviderRef,
    };
  }
}