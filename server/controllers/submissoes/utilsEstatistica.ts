
import { TipoTreino } from "@prisma/client";
import { prisma } from "../../prisma.js";

export async function aplicarEstatisticasPosSubmissao(
  submissaoId: string,
  atletaId: string,
  treinoAgendadoId: string,
  duracaoMinutos?: number
) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.submissaoTreino.findUnique({
      where: { id: submissaoId },
      include: {
        treinoAgendado: {
          include: {
            treinoProgramado: true,
          },
        },
      },
    });

    if (!sub) {
      throw new Error("SUBMISSAO_NAO_ENCONTRADA");
    }

    if (
      sub.atletaId !== atletaId ||
      sub.treinoAgendadoId !== treinoAgendadoId
    ) {
      throw new Error("SUBMISSAO_ATLETA_MISMATCH");
    }

    if (sub.aprovado !== true) {
      return { processado: false };
    }

    // Apenas uma transação consegue alterar
    // NULL para a data de processamento.
    const reserva = await tx.submissaoTreino.updateMany({
      where: {
        id: submissaoId,
        estatisticasProcessadasEm: null,
      },
      data: {
        estatisticasProcessadasEm: new Date(),
      },
    });

    if (reserva.count === 0) {
      return { processado: false };
    }

    const tp = sub.treinoAgendado?.treinoProgramado;

    const minutos = Number(
      duracaoMinutos ??
      sub.duracaoMinutos ??
      tp?.duracao ??
      0
    );

    // Preserva a pontuação já calculada
    // no controller, inclusive penalidades.
    const pontos = Number(
      sub.pontosCreditados ??
      sub.pontuacaoSnapshot ??
      tp?.pontuacao ??
      0
    );

    await tx.submissaoTreino.update({
      where: { id: submissaoId },
      data: {
        treinoTituloSnapshot:
          sub.treinoTituloSnapshot ??
          tp?.nome ??
          sub.treinoAgendado?.titulo ??
          "Treino",
        tipoTreinoSnapshot:
          (sub.tipoTreinoSnapshot ??
            tp?.tipoTreino ??
            null) as TipoTreino | null,
        duracaoMinutos:
          sub.duracaoMinutos ??
          Math.max(0, Math.round(minutos)),
        pontuacaoSnapshot:
          sub.pontuacaoSnapshot ?? pontos,
        pontosCreditados:
          sub.pontosCreditados ?? pontos,
      },
    });

    if (tp?.id) {
      // Recalcula em vez de acrescentar +1
      // indiscriminadamente.
      const realizacoes =
        await tx.submissaoTreino.count({
          where: {
            aprovado: true,
            treinoAgendado: {
              treinoProgramadoId: tp.id,
            },
          },
        });

      await tx.estatisticaTreino.upsert({
        where: { treinoId: tp.id },
        create: {
          treinoId: tp.id,
          realizacoes,
          ultimoRealizadoEm: new Date(),
        },
        update: {
          realizacoes,
          ultimoRealizadoEm: new Date(),
        },
      });
    }

    await tx.estatisticaAtleta.upsert({
      where: { atletaId },
      create: {
        atletaId,
        totalTreinos: 1,
        horasTreinadas: minutos / 60,
        totalPontos: pontos,
        fisico: 0,
        tecnico: 0,
        tatico: 0,
        mental: 0,
        totalDesafios: 0,
      },
      update: {
        totalTreinos: { increment: 1 },
        horasTreinadas: {
          increment: minutos / 60,
        },
        totalPontos: { increment: pontos },
      },
    });

    // PontuacaoAtleta é calculada pelo serviço
    // recomputePontuacaoAtleta, não incrementada aqui.
    return { processado: true };
  });
}