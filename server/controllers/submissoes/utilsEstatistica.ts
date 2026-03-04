import { PrismaClient, TipoTreino, TreinoAgendadoStatus, TreinoStatus } from "@prisma/client";

const prisma = new PrismaClient();

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
        atleta: { select: { usuarioId: true } }, // ✅ precisa pra atualizar TreinoUsuario
        treinoAgendado: { include: { treinoProgramado: true } },
      },
    });
    if (!sub) return;

    const tp = sub.treinoAgendado?.treinoProgramado;
    const minutos = Number(duracaoMinutos ?? sub.duracaoMinutos ?? tp?.duracao ?? 0) || 0;
    const pontos = Number(tp?.pontuacao ?? 0) || 0;

    // ✅ 1) aprova a submissão (você já fazia)
    await tx.submissaoTreino.update({
      where: { id: sub.id },
      data: {
        aprovado: true,
        treinoTituloSnapshot: tp?.nome ?? sub?.treinoAgendado?.titulo ?? "Treino",
        tipoTreinoSnapshot: (tp?.tipoTreino ?? null) as TipoTreino | null,
        duracaoMinutos: minutos,
        pontuacaoSnapshot: pontos,
        pontosCreditados: pontos,
      },
    });

    // ✅ 2) AQUI É O PULO DO GATO:
    // quando aprovou, marca o TreinoAgendado como concluído
    const realAgendadoId = sub.treinoAgendadoId; // vem do banco, 100% correto
    if (realAgendadoId) {
      await tx.treinoAgendado.update({
        where: { id: realAgendadoId },
        data: {
          status: TreinoAgendadoStatus.CONCLUIDO,
          execucaoStatus: TreinoStatus.COMPLETED,
          finishedAt: new Date(),
          duracaoSegundos: Math.round(minutos * 60),
        },
      });
    }

    // ✅ 3) (recomendado) mantém TreinoUsuario consistente,
    // porque em outras rotas você usa isso também.
    const usuarioId = sub.atleta?.usuarioId;
    if (usuarioId && realAgendadoId) {
      await tx.treinoUsuario.upsert({
        where: { treinoId_usuarioId: { treinoId: realAgendadoId, usuarioId } },
        update: { status: TreinoStatus.COMPLETED, completedAt: new Date() },
        create: {
          treinoId: realAgendadoId,
          usuarioId,
          status: TreinoStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    // ... seu resto (estatisticaTreino, estatisticaAtleta, pontuacaoAtleta) continua igual
    const treinoProgramadoId = tp?.id;
    if (treinoProgramadoId) {
      await tx.estatisticaTreino.upsert({
        where: { treinoId: treinoProgramadoId },
        update: { realizacoes: { increment: 1 }, ultimoRealizadoEm: new Date() },
        create: { treinoId: treinoProgramadoId, realizacoes: 1, ultimoRealizadoEm: new Date() },
      });
    }

    await tx.estatisticaAtleta.upsert({
      where: { atletaId },
      update: {
        totalTreinos: { increment: 1 },
        horasTreinadas: { increment: minutos / 60 },
        totalPontos: { increment: pontos },
      },
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
    });

    await tx.pontuacaoAtleta.upsert({
      where: { atletaId },
      update: { pontuacaoPerformance: { increment: pontos }, pontuacaoTotal: { increment: pontos } },
      create: {
        atletaId,
        pontuacaoPerformance: pontos,
        pontuacaoTotal: pontos,
        pontuacaoDisciplina: 0,
        pontuacaoResponsabilidade: 0,
      },
    });
  });
}