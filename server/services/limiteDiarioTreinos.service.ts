
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export const LIMITE_TREINOS_DIARIOS_FREE = 3;

export const CODIGO_LIMITE_TREINOS_DIARIOS =
  "DAILY_TRAINING_LIMIT_REACHED";

export type TreinoTx = Prisma.TransactionClient;

export class LimiteDiarioTreinosError extends Error {
  readonly code = CODIGO_LIMITE_TREINOS_DIARIOS;
  readonly status = 403;
  readonly allowed = LIMITE_TREINOS_DIARIOS_FREE;
  readonly remaining = 0;

  constructor(
    readonly used: number,
    readonly date: string
  ) {
    super(
      "Você atingiu o limite de 3 treinos diários do plano gratuito."
    );
    this.name = "LimiteDiarioTreinosError";
  }
}

export function janelaDiaTreino(data: Date) {
  if (Number.isNaN(data.getTime())) {
    throw new Error("DATA_TREINO_INVALIDA");
  }

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const parte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  const dia = [
    parte("year"),
    parte("month"),
    parte("day"),
  ].join("-");

  // Horário atual de Brasília: UTC-03:00.
  const inicio = new Date(`${dia}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 86400000);

  return { dia, inicio, fim };
}

async function atletaPossuiPlanoPago(
  tx: TreinoTx,
  atletaId: string,
  agora: Date
): Promise<boolean> {
  const atleta = await tx.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });

  if (!atleta) {
    throw new Error("ATLETA_NAO_ENCONTRADO");
  }

  const assinaturas = await tx.assinatura.findMany({
    where: {
      usuarioId: atleta.usuarioId,
      contextoKey: "personal:Atleta",
      ativo: true,
      bloqueadoEm: null,
      startsAt: { lte: agora },
      plano: {
        in: [
          "ATLETA_PRO",
          "ATLETA_LEARNING_1",
          "ATLETA_LEARNING_3",
        ],
      },
      status: {
        in: ["ATIVA", "TRIAL"],
      },
    },
    select: {
      status: true,
      renovaEm: true,
      trialEndsAt: true,
      canceledAt: true,
    },
  });

  return assinaturas.some((assinatura) => {
    // Uma assinatura já cancelada não concede benefício
    // depois da data de cancelamento.
    if (
      assinatura.canceledAt &&
      assinatura.canceledAt <= agora
    ) {
      return false;
    }

    if (assinatura.status === "TRIAL") {
      return (
        assinatura.trialEndsAt !== null &&
        assinatura.trialEndsAt > agora
      );
    }

    return (
      assinatura.status === "ATIVA" &&
      assinatura.renovaEm > agora
    );
  });
}

async function contarTreinosDoDia(
  tx: TreinoTx,
  atletaId: string,
  inicio: Date,
  fim: Date
): Promise<number> {
  const { dia } = janelaDiaTreino(inicio);

  // Histórico permanente do dia consultado.
  const historicoDia =
    await tx.treinoRealizacaoDiaria.findMany({
      where: {
        atletaId,
        diaReferencia: dia,
      },
      select: {
        origem: true,
        origemId: true,
      },
    });

  // Registros legados que ainda existem nas
  // tabelas originais.
  const [livres, agendados] = await Promise.all([
    tx.treinoLivre.findMany({
      where: {
        atletaId,
        data: {
          gte: inicio,
          lt: fim,
        },
      },
      select: {
        id: true,
      },
    }),

    tx.treinoAgendado.findMany({
      where: {
        atletaId,
        status: "CONCLUIDO",
        OR: [
          {
            finishedAt: {
              gte: inicio,
              lt: fim,
            },
          },
          {
            finishedAt: null,
            dataTreino: {
              gte: inicio,
              lt: fim,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    }),
  ]);

  // Consulta o histórico das realizações legadas
  // em QUALQUER data, não apenas na data atual.
  //
  // Isso impede que o mesmo treino seja contado
  // novamente se sua data original for alterada.
  const historicoDosLegados =
    livres.length > 0 || agendados.length > 0
      ? await tx.treinoRealizacaoDiaria.findMany({
          where: {
            atletaId,
            OR: [
              ...(livres.length > 0
                ? [{
                    origem: "LIVRE",
                    origemId: {
                      in: livres.map((t) => t.id),
                    },
                  }]
                : []),

              ...(agendados.length > 0
                ? [{
                    origem: "AGENDADO",
                    origemId: {
                      in: agendados.map((t) => t.id),
                    },
                  }]
                : []),
            ],
          },
          select: {
            origem: true,
            origemId: true,
          },
        })
      : [];

  const chavesRegistradas = new Set(
    historicoDosLegados.map(
      (registro) =>
        `${registro.origem}:${registro.origemId}`
    )
  );

  const livresLegados = livres.filter(
    (treino) =>
      !chavesRegistradas.has(`LIVRE:${treino.id}`)
  ).length;

  const agendadosLegados = agendados.filter(
    (treino) =>
      !chavesRegistradas.has(`AGENDADO:${treino.id}`)
  ).length;

  return (
    historicoDia.length +
    livresLegados +
    agendadosLegados
  );
}

export async function registrarRealizacaoDiaria(
  tx: TreinoTx,
  params: {
    atletaId: string;
    origem: "LIVRE" | "AGENDADO";
    origemId: string;
    realizadoEm: Date;
  }
) {
  const { dia } = janelaDiaTreino(params.realizadoEm);

  return tx.treinoRealizacaoDiaria.upsert({
    where: {
      atletaId_origem_origemId: {
        atletaId: params.atletaId,
        origem: params.origem,
        origemId: params.origemId,
      },
    },
    create: {
      atletaId: params.atletaId,
      origem: params.origem,
      origemId: params.origemId,
      diaReferencia: dia,
      realizadoEm: params.realizadoEm,
    },
    update: {},
  });
}

/**
 * Valida a cota dentro de uma transação existente.
 *
 * Todos os endpoints precisam adquirir o mesmo
 * advisory lock antes de verificar e gravar.
 *
 * jaContado=true indica que a realização já foi
 * registrada anteriormente. Nesse caso, atualizar
 * a submissão não deve consumir outra cota.
 */
export async function verificarLimiteDiarioNaTransacao(
  tx: TreinoTx,
  params: {
    atletaId: string;
    data?: Date;
    jaContado?: boolean;
  }
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
        hashtext('footera_daily_training'),
        hashtext(${params.atletaId})
    )::text AS lock_result
    `;

  const referencia = params.data ?? new Date();
  const { dia, inicio, fim } = janelaDiaTreino(referencia);

  const isento = await atletaPossuiPlanoPago(
    tx,
    params.atletaId,
    new Date()
  );

  const usados = await contarTreinosDoDia(
    tx,
    params.atletaId,
    inicio,
    fim
  );

  if (
    !isento &&
    !params.jaContado &&
    usados >= LIMITE_TREINOS_DIARIOS_FREE
  ) {
    throw new LimiteDiarioTreinosError(usados, dia);
  }

  return {
    date: dia,
    exempt: isento,
    used: usados,
    allowed: isento ? null : LIMITE_TREINOS_DIARIOS_FREE,
    remaining: isento
      ? null
      : Math.max(0, LIMITE_TREINOS_DIARIOS_FREE - usados),
  };
}

/**
 * Executa a validação e a gravação atomicamente.
 *
 * Utilizado inicialmente pelos treinos livres
 * e, depois, pelas conclusões agendadas.
 */
export async function executarComLimiteDiarioTreinos<T>(
  params: {
    atletaId: string;
    data?: Date;
    jaContado?: (tx: TreinoTx) => Promise<boolean>;
    gravar: (tx: TreinoTx) => Promise<T>;
  }
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
            hashtext('footera_daily_training'),
            hashtext(${params.atletaId})
        )::text AS lock_result
        `;

      const jaContado = params.jaContado
        ? await params.jaContado(tx)
        : false;

      await verificarLimiteDiarioNaTransacao(tx, {
        atletaId: params.atletaId,
        data: params.data,
        jaContado,
      });

      return params.gravar(tx);
    },
    {
      timeout: 15000,
      maxWait: 10000,
    }
  );
}

export async function consultarLimiteDiarioTreinos(
  atletaId: string,
  data: Date = new Date()
) {
  const { dia, inicio, fim } = janelaDiaTreino(data);

  return prisma.$transaction(async (tx) => {
    const isento = await atletaPossuiPlanoPago(
      tx,
      atletaId,
      new Date()
    );

    const usados = await contarTreinosDoDia(
      tx,
      atletaId,
      inicio,
      fim
    );

    return {
      date: dia,
      exempt: isento,
      used: usados,
      allowed: isento
        ? null
        : LIMITE_TREINOS_DIARIOS_FREE,
      remaining: isento
        ? null
        : Math.max(
            0,
            LIMITE_TREINOS_DIARIOS_FREE - usados
          ),
    };
  });
}

export function respostaErroLimiteDiario(
  error: unknown
) {
  if (!(error instanceof LimiteDiarioTreinosError)) {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
    allowed: error.allowed,
    used: error.used,
    remaining: error.remaining,
    date: error.date,
  };
}


/**
 * Serializa uma operação por atleta sem consumir
 * ou exigir disponibilidade na cota diária.
 *
 * Uso: início/reabertura controlada de um treino.
 *
 * A conclusão continua obrigatoriamente utilizando
 * executarComLimiteDiarioTreinos().
 */
export async function executarComBloqueioAtleta<T>(
  params: {
    atletaId: string;
    gravar: (tx: TreinoTx) => Promise<T>;
  }
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('footera_daily_training'),
          hashtext(${params.atletaId})
        )::text AS lock_result
      `;

      return params.gravar(tx);
    },
    {
      timeout: 15000,
      maxWait: 10000,
    }
  );
}