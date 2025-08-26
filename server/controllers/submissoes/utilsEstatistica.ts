import { PrismaClient, TipoTreino } from "@prisma/client";
const prisma = new PrismaClient();

function mapTipoToKey(tipo?: TipoTreino | string | null) {
  if (!tipo) return null;
  const t = String(tipo).toLowerCase();
  if (t.includes("físico") || t.includes("fisico")) return "fisico";
  if (t.includes("tecnico") || t.includes("técnico")) return "tecnico";
  if (t.includes("tatico") || t.includes("tático")) return "tatico";
  if (t.includes("mental")) return "mental";
  return null;
}

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
        treinoAgendado: { include: { treinoProgramado: true } },
      },
    });
    if (!sub) return;

    const tp = sub.treinoAgendado?.treinoProgramado;
    const tipoKey = mapTipoToKey(tp?.tipoTreino);

    const minutos =
      Number(duracaoMinutos ?? sub.duracaoMinutos ?? tp?.duracao ?? 0) || 0;
    const horas = minutos / 60;
    const pontos = Number(tp?.pontuacao ?? 0) || 0;

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

    await tx.estatisticaAtleta.upsert({
      where: { atletaId },
      update: {
        totalTreinos:   { increment: 1 },
        horasTreinadas: { increment: horas },
        totalPontos:    { increment: pontos },
        ...(tipoKey === "fisico"  ? { fisico:  { increment: 1 } } : {}),
        ...(tipoKey === "tecnico" ? { tecnico: { increment: 1 } } : {}),
        ...(tipoKey === "tatico"  ? { tatico:  { increment: 1 } } : {}),
        ...(tipoKey === "mental"  ? { mental:  { increment: 1 } } : {}),
      },
      create: {
        atletaId,
        totalTreinos: 1,
        horasTreinadas: horas,
        totalPontos: pontos,
        fisico:  tipoKey === "fisico"  ? 1 : 0,
        tecnico: tipoKey === "tecnico" ? 1 : 0,
        tatico:  tipoKey === "tatico"  ? 1 : 0,
        mental:  tipoKey === "mental"  ? 1 : 0,
        totalDesafios: 0,
      },
    });

    await tx.pontuacaoAtleta.upsert({
      where: { atletaId },
      update: {
        pontuacaoPerformance: { increment: pontos },
        pontuacaoTotal:       { increment: pontos },
      },
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