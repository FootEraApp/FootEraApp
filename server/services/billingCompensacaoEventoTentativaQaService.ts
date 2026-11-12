
import { prisma } from "../prisma.js";

function validarAmbienteQa(): void {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  const bloqueios = [
    [process.env.NODE_ENV !== "test", "NODE_ENV"],
    [Boolean(process.env.MP_ACCESS_TOKEN), "MP_ACCESS_TOKEN"],
    [
      process.env.BILLING_CUPOM_RESERVA_QA !== "true",
      "BILLING_CUPOM_RESERVA_QA",
    ],
    [
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false",
      "ENABLE_MP_CONCILIACAO_SCHEDULER",
    ],
    [
      process.env.ENABLE_BILLING_SCHEDULER !== "false",
      "ENABLE_BILLING_SCHEDULER",
    ],
    [db.protocol !== "postgresql:", "PROTOCOLO"],
    [
      !["127.0.0.1", "localhost"].includes(db.hostname),
      "HOST",
    ],
    [db.port !== "5433", "PORTA"],
    [db.pathname !== "/footera_billing_qa", "BANCO"],
  ] as const;

  const motivos = bloqueios
    .filter(([bloqueado]) => bloqueado)
    .map(([, nome]) => nome);

  if (motivos.length > 0) {
    throw new Error(
      "BILLING_COMPENSACAO_TENTATIVA_QA_DISABLED: " +
      motivos.join(", ")
    );
  }
}

async function conferirBancoQa() {
  validarAmbienteQa();

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  if (banco[0]?.nome !== "footera_billing_qa") {
    throw new Error("QA_BANCO_INCORRETO");
  }
}

/**
 * Adquire exclusivamente uma tentativa QA
 * e registra seu histórico na mesma transação.
 *
 * NÃO efetua estorno no Mercado Pago.
 */
export async function iniciarTentativaCompensacaoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: {
        pagamento: true,
        pendencia: true,
      },
    });

  if (!compensacao) {
    throw new Error("QA_COMPENSACAO_NAO_ENCONTRADA");
  }

  const pg = compensacao.pagamento;
  const pendencia = compensacao.pendencia;

  if (
    pg.status !== "PENDENTE" ||
    pg.provider !== "MERCADOPAGO" ||
    pg.plano !== `EVENTO:${pendencia.eventoId}` ||
    pg.providerRef !== compensacao.providerRef ||
    pendencia.pagamentoId !== pagamentoId ||
    pendencia.status !== "PENDENTE_ANALISE" ||
    !pg.valor.equals(compensacao.valor) ||
    pg.moeda !== compensacao.moeda
  ) {
    throw new Error(
      "QA_COMPENSACAO_DADOS_INCONSISTENTES"
    );
  }

  const [beneficios, inscricoes] = await Promise.all([
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
    throw new Error("QA_COMPENSACAO_ACESSO_EXISTENTE");
  }

  // A mudança de estado e a inserção do histórico
  // formam uma única transação.
  return prisma.$transaction(async (tx) => {
    const adquirido =
      await tx.billingCompensacaoEvento.updateMany({
        where: {
          id: compensacao.id,
          status: "PREPARADA",
          tentativas: 0,
          confirmadoEm: null,
        },
        data: {
          status: "EM_PROCESSAMENTO",
          tentativas: { increment: 1 },
          ultimoErro: null,
        },
      });

    if (adquirido.count !== 1) {
      return {
        adquirida: false,
        pagamentoId,
        compensacaoId: compensacao.id,
        tentativaId: null as string | null,
      };
    }

    const tentativa =
      await tx.billingCompensacaoTentativa.create({
        data: {
          compensacaoId: compensacao.id,
          numero: 1,
          status: "EM_PROCESSAMENTO",
          ambiente: "QA",
          operacaoExternaExecutada: false,
          observacao:
            "Tentativa QA adquirida sem chamada externa.",
        },
      });

    return {
      adquirida: true,
      pagamentoId,
      compensacaoId: compensacao.id,
      tentativaId: tentativa.id,
    };
  });
}

/**
 * Finaliza a simulação QA.
 * Não altera o pagamento nem registra estorno.
 */
export async function finalizarTentativaCompensacaoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  return prisma.$transaction(async (tx) => {
    const compensacao =
      await tx.billingCompensacaoEvento.findUnique({
        where: { pagamentoId },
      });

    if (!compensacao) {
      throw new Error("QA_COMPENSACAO_NAO_ENCONTRADA");
    }

    const adquirido =
      await tx.billingCompensacaoEvento.updateMany({
        where: {
          id: compensacao.id,
          status: "EM_PROCESSAMENTO",
          tentativas: 1,
          confirmadoEm: null,
        },
        data: {
          status: "FALHA_REVISAR",
          ultimoErro:
            "QA_SIMULACAO_ENCERRADA_SEM_CHAMADA_AO_PROVEDOR",
        },
      });

    if (adquirido.count !== 1) {
      return { finalizada: false };
    }

    const historico =
      await tx.billingCompensacaoTentativa.updateMany({
        where: {
          compensacaoId: compensacao.id,
          numero: 1,
          status: "EM_PROCESSAMENTO",
          ambiente: "QA",
          operacaoExternaExecutada: false,
          chaveIdempotenciaOperacao: null,
          estornoProviderRef: null,
          requisicaoEnviadaEm: null,
        },
        data: {
          status: "SIMULACAO_ENCERRADA",
          encerradoEm: new Date(),
          observacao:
            "Simulação encerrada sem estorno no Mercado Pago.",
        },
      });

    if (historico.count !== 1) {
      throw new Error(
        "QA_HISTORICO_TENTATIVA_INCONSISTENTE"
      );
    }

    return { finalizada: true };
  });
}


/**
 * Simula a situação em que o resultado de uma
 * operação financeira não pôde ser confirmado.
 *
 * QA EXCLUSIVO:
 * - Não chama o Mercado Pago.
 * - Não executa reembolso.
 * - Não altera o Pagamento.
 * - Bloqueia novas tentativas automáticas.
 */
export async function simularResultadoDesconhecidoCompensacaoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  return prisma.$transaction(async (tx) => {
    const compensacao =
      await tx.billingCompensacaoEvento.findUnique({
        where: { pagamentoId },
      });

    if (!compensacao) {
      throw new Error(
        "QA_COMPENSACAO_NAO_ENCONTRADA"
      );
    }

    // Só é permitido sair de uma tentativa
    // adquirida e ainda em processamento.
    const atualizado =
      await tx.billingCompensacaoEvento.updateMany({
        where: {
          id: compensacao.id,
          status: "EM_PROCESSAMENTO",
          tentativas: 1,
          confirmadoEm: null,
        },
        data: {
          status: "AGUARDANDO_CONFIRMACAO",
          ultimoErro:
            "QA_RESULTADO_EXTERNO_DESCONHECIDO",
        },
      });

    if (atualizado.count !== 1) {
      return {
        registrada: false,
        motivo: "TENTATIVA_NAO_ESTA_EM_PROCESSAMENTO",
      };
    }

    const historico =
      await tx.billingCompensacaoTentativa.updateMany({
        where: {
          compensacaoId: compensacao.id,
          numero: 1,
          status: "EM_PROCESSAMENTO",
          ambiente: "QA",
          operacaoExternaExecutada: false,
        },
        data: {
          status: "RESULTADO_DESCONHECIDO",
          encerradoEm: new Date(),
          observacao:
            "Cenário simulado de resposta externa desconhecida. Nenhum estorno foi enviado.",
        },
      });

    if (historico.count !== 1) {
      throw new Error(
        "QA_HISTORICO_RESULTADO_DESCONHECIDO_INCONSISTENTE"
      );
    }

    return {
      registrada: true,
      compensacaoId: compensacao.id,
      tentativaId:
        (
          await tx.billingCompensacaoTentativa.findUniqueOrThrow({
            where: {
              compensacaoId_numero: {
                compensacaoId: compensacao.id,
                numero: 1,
              },
            },
            select: { id: true },
          })
        ).id,
    };
  });
}

/**
 * Reserva a chave de idempotencia da tentativa QA.
 *
 * Esta funcao NAO envia requisicao ao Mercado Pago.
 * NAO marca uma operacao externa como executada.
 * NAO cria ou confirma estorno.
 *
 * Concorrencia: somente uma chamada pode
 * preencher a chave antes vazia.
 */
export async function reservarChaveOperacaoCompensacaoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  return prisma.$transaction(async (tx) => {
    const compensacao =
      await tx.billingCompensacaoEvento.findUnique({
        where: { pagamentoId },
        include: {
          historicoTentativas: {
            where: { numero: 1 },
            take: 1,
          },
        },
      });

    if (!compensacao) {
      throw new Error(
        "QA_COMPENSACAO_NAO_ENCONTRADA"
      );
    }

    const tentativa =
      compensacao.historicoTentativas[0];

    if (
      !tentativa ||
      compensacao.status !== "EM_PROCESSAMENTO" ||
      compensacao.tentativas !== 1 ||
      compensacao.confirmadoEm !== null ||
      tentativa.status !== "EM_PROCESSAMENTO" ||
      tentativa.ambiente !== "QA" ||
      tentativa.operacaoExternaExecutada !== false ||
      tentativa.requisicaoEnviadaEm !== null ||
      tentativa.estornoProviderRef !== null
    ) {
      return {
        reservada: false,
        motivo: "ESTADO_NAO_PERMITE_RESERVA",
        chaveIdempotencia: null as string | null,
      };
    }

    const chave = compensacao.chaveIdempotencia;

    if (
      chave !==
      `footera-evento-refund-${pagamentoId}`
    ) {
      throw new Error(
        "QA_CHAVE_IDEMPOTENCIA_INCONSISTENTE"
      );
    }

    // Compare-and-set:
    // apenas a primeira chamada que encontrar
    // chaveIdempotenciaOperacao = null vence.
    const atualizada =
      await tx.billingCompensacaoTentativa.updateMany({
        where: {
          id: tentativa.id,
          compensacaoId: compensacao.id,
          numero: 1,
          status: "EM_PROCESSAMENTO",
          ambiente: "QA",
          operacaoExternaExecutada: false,
          chaveIdempotenciaOperacao: null,
          estornoProviderRef: null,
          requisicaoEnviadaEm: null,
          compensacao: {
            is: {
              status: "EM_PROCESSAMENTO",
              tentativas: 1,
              confirmadoEm: null,
            },
          },
        },
        data: {
          chaveIdempotenciaOperacao: chave,
          observacao:
            "Chave reservada no QA. Nenhuma requisicao externa enviada.",
        },
      });

    if (atualizada.count !== 1) {
      return {
        reservada: false,
        motivo: "CHAVE_JA_RESERVADA",
        chaveIdempotencia: null as string | null,
      };
    }

    return {
      reservada: true,
      motivo: "CHAVE_RESERVADA_SEM_ENVIO",
      compensacaoId: compensacao.id,
      tentativaId: tentativa.id,
      chaveIdempotencia: chave,
      operacaoExternaExecutada: false,
    };
  });
}


/**
 * QA: registra a possibilidade de envio de uma
 * operacao financeira antes de qualquer HTTP.
 *
 * Nao envia estorno.
 * Nao marca operacao externa como executada.
 * Nao atualiza o pagamento.
 * Bloqueia uma segunda reserva da mesma chave.
 */
export async function registrarIntencaoEnvioEstornoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  const chaveEsperada =
    `footera-evento-refund-${pagamentoId}`;

  return prisma.$transaction(
    async (tx) => {
      const compensacao =
        await tx.billingCompensacaoEvento.findUnique({
          where: { pagamentoId },
          include: {
            pagamento: true,
            pendencia: true,
            historicoTentativas: {
              where: { numero: 1 },
              take: 1,
            },
          },
        });

      if (!compensacao) {
        throw new Error(
          "QA_INTENCAO_COMPENSACAO_NAO_ENCONTRADA"
        );
      }

      const tentativa =
        compensacao.historicoTentativas[0];

      const pg = compensacao.pagamento;
      const pendencia = compensacao.pendencia;

      if (
        pg.id !== pagamentoId ||
        pg.provider !== "MERCADOPAGO" ||
        pg.status !== "PENDENTE" ||
        pg.reembolsadoEm !== null ||
        pg.plano !== `EVENTO:${pendencia.eventoId}` ||
        pg.providerRef !== compensacao.providerRef ||
        pendencia.pagamentoId !== pagamentoId ||
        pendencia.providerRef !== compensacao.providerRef ||
        pendencia.motivo !==
          "BILLING_EVENT_CAPACITY_EXCEEDED" ||
        !["PENDENTE_ANALISE", "EM_ANALISE"].includes(
          pendencia.status
        ) ||
        pg.moeda !== "BRL" ||
        compensacao.moeda !== "BRL" ||
        pendencia.moeda !== "BRL" ||
        !pg.valor.equals(compensacao.valor) ||
        !pendencia.valor.equals(compensacao.valor) ||
        !/^\d+$/.test(compensacao.providerRef)
      ) {
        throw new Error(
          "QA_INTENCAO_DADOS_FINANCEIROS_INCONSISTENTES"
        );
      }

      const beneficios = await tx.pagamentoBeneficio.count({
        where: { pagamentoId },
      });

      const inscricoes = await tx.inscricaoEvento.count({
        where: {
          eventoId: pendencia.eventoId,
          usuarioId: pg.usuarioId,
          status: { not: "CANCELADA" },
        },
      });

      if (beneficios !== 0 || inscricoes !== 0) {
        throw new Error(
          "QA_INTENCAO_ACESSO_EXISTENTE"
        );
      }

      if (
        !tentativa ||
        compensacao.status !== "EM_PROCESSAMENTO" ||
        compensacao.tentativas !== 1 ||
        compensacao.confirmadoEm !== null ||
        compensacao.chaveIdempotencia !== chaveEsperada ||
        tentativa.status !== "EM_PROCESSAMENTO" ||
        tentativa.ambiente !== "QA" ||
        tentativa.chaveIdempotenciaOperacao !== chaveEsperada ||
        tentativa.estornoProviderRef !== null ||
        tentativa.requisicaoEnviadaEm !== null ||
        tentativa.operacaoExternaExecutada !== false
      ) {
        return {
          registrada: false,
          motivo: "ESTADO_NAO_PERMITE_INTENCAO",
        };
      }

      const alteracao =
        await tx.billingCompensacaoTentativa.updateMany({
          where: {
            id: tentativa.id,
            compensacaoId: compensacao.id,
            status: "EM_PROCESSAMENTO",
            ambiente: "QA",
            chaveIdempotenciaOperacao: chaveEsperada,
            requisicaoEnviadaEm: null,
            estornoProviderRef: null,
            operacaoExternaExecutada: false,
          },
          data: {
            status: "CONFIRMACAO_EXTERNA_PENDENTE",
            observacao:
              "QA: intencao persistida. Nenhuma requisicao externa enviada.",
          },
        });

      if (alteracao.count !== 1) {
        return {
          registrada: false,
          motivo: "INTENCAO_JA_REGISTRADA",
        };
      }

      const estado =
        await tx.billingCompensacaoEvento.updateMany({
          where: {
            id: compensacao.id,
            status: "EM_PROCESSAMENTO",
            tentativas: 1,
            confirmadoEm: null,
          },
          data: {
            status: "AGUARDANDO_CONFIRMACAO",
            ultimoErro:
              "QA_INTENCAO_ENVIO_SEM_CONFIRMACAO_EXTERNA",
          },
        });

      if (estado.count !== 1) {
        throw new Error(
          "QA_INTENCAO_ESTADO_INCONSISTENTE"
        );
      }

      return {
        registrada: true,
        motivo: "INTENCAO_PERSISTIDA",
        pagamentoId,
        compensacaoId: compensacao.id,
        tentativaId: tentativa.id,
        chaveIdempotencia: chaveEsperada,
        operacaoExternaExecutada: false,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function avaliarRetomadaCompensacaoQa(
  pagamentoId: string
) {
  await conferirBancoQa();

  const compensacao =
    await prisma.billingCompensacaoEvento.findUnique({
      where: { pagamentoId },
      include: {
        historicoTentativas: {
          orderBy: { numero: "desc" },
          take: 2,
        },
      },
    });

  if (!compensacao) {
    throw new Error(
      "QA_RETOMADA_COMPENSACAO_NAO_ENCONTRADA"
    );
  }

  const tentativa =
    compensacao.historicoTentativas[0];

  const resposta = (motivo: string) => ({
    pagamentoId,
    compensacaoId: compensacao.id,
    tentativaId: tentativa?.id ?? null,
    motivo,
    chaveIdempotencia:
      tentativa?.chaveIdempotenciaOperacao ?? null,

    // Recuperação é exclusivamente observacional.
    podeEnviarEstorno: false,
    podeRepetirEstorno: false,
    podeConfirmarCompensacao: false,
    atualizarPagamento: false,
  });

  if (
    compensacao.historicoTentativas.length !== 1 ||
    !tentativa ||
    compensacao.tentativas !== 1 ||
    compensacao.confirmadoEm !== null ||
    tentativa.numero !== 1 ||
    tentativa.compensacaoId !== compensacao.id ||
    tentativa.ambiente !== "QA"
  ) {
    return resposta(
      "HISTORICO_INCONSISTENTE_REVISAO"
    );
  }

  if (
    tentativa.chaveIdempotenciaOperacao !==
    compensacao.chaveIdempotencia ||
    compensacao.chaveIdempotencia !==
    `footera-evento-refund-${pagamentoId}`
  ) {
    return resposta(
      "CHAVE_IDEMPOTENCIA_INCONSISTENTE"
    );
  }

  if (
    tentativa.estornoProviderRef !== null ||
    tentativa.requisicaoEnviadaEm !== null ||
    tentativa.operacaoExternaExecutada !== false
  ) {
    return resposta(
      "POSSIVEL_OPERACAO_EXTERNA_REVISAO"
    );
  }

  if (
    compensacao.status === "EM_PROCESSAMENTO" &&
    tentativa.status === "EM_PROCESSAMENTO" &&
    tentativa.encerradoEm === null
  ) {
    return resposta(
      "CHAVE_RESERVADA_SEM_ENVIO_REGISTRADO"
    );
  }

  if (
    compensacao.status === "AGUARDANDO_CONFIRMACAO" &&
    tentativa.status === "CONFIRMACAO_EXTERNA_PENDENTE" &&
    tentativa.encerradoEm === null &&
    tentativa.requisicaoEnviadaEm === null &&
    tentativa.operacaoExternaExecutada === false &&
    tentativa.estornoProviderRef === null
  ) {
    return resposta(
      "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO"
    );
  }

  if (
    compensacao.status ===
      "AGUARDANDO_CONFIRMACAO" &&
    tentativa.status === "RESULTADO_DESCONHECIDO" &&
    tentativa.encerradoEm !== null
  ) {
    return resposta(
      "RESULTADO_DESCONHECIDO_BLOQUEADO"
    );
  }

  return resposta(
    "ESTADO_INCOMPATIVEL_REVISAO"
  );
}