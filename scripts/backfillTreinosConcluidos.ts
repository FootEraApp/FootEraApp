import { PrismaClient } from "@prisma/client";
import { recomputePontuacaoAtleta } from "../server/services/recomputePontuacao";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "TreinoAgendado"
    WHERE status = 'CONCLUIDO'
      AND "atletaId" IS NOT NULL
  `;

  let criadas = 0;

  for (const row of rows) {
    const ag = await prisma.treinoAgendado.findUnique({
      where: { id: row.id },
      include: {
        atleta: { select: { id: true, usuarioId: true } },
        treinoProgramado: true,
        submissaoTreinos: { select: { id: true } },
      } as any,
    });

    if (!ag) continue;

    const anyAg = ag as any;

    if (!anyAg.atletaId || !anyAg.atleta?.usuarioId) continue;
    if (anyAg.submissaoTreinos?.length) continue;

    const pontos = Number(anyAg.treinoProgramado?.pontuacao ?? 0);

    const duracaoMinutos = anyAg.duracaoSegundos
      ? Math.max(1, Math.round(Number(anyAg.duracaoSegundos) / 60))
      : Number(anyAg.treinoProgramado?.duracao ?? 1);

    await prisma.submissaoTreino.create({
      data: {
        atletaId: anyAg.atletaId,
        usuarioId: anyAg.atleta.usuarioId,
        treinoAgendadoId: anyAg.id,
        aprovado: true,
        pontosCreditados: pontos,
        pontuacaoSnapshot: pontos,
        duracaoMinutos,
        duracaoSegundos: anyAg.duracaoSegundos ?? null,
        tipoTreinoSnapshot: anyAg.treinoProgramado?.tipoTreino ?? null,
        treinoTituloSnapshot:
          anyAg.treinoProgramado?.nome ?? anyAg.titulo ?? "Treino",
      } as any,
    });

    await prisma.atividadeRecente.create({
      data: {
        usuarioId: anyAg.atleta.usuarioId,
        tipo: anyAg.treinoProgramado?.tipoTreino
          ? `Treino ${anyAg.treinoProgramado.tipoTreino}`
          : "Treino",
        titulo:
          anyAg.treinoProgramado?.nome ?? anyAg.titulo ?? "Treino concluído",
        imagemUrl: anyAg.treinoProgramado?.imagemUrl ?? null,
        link: `/submissao?treinoAgendadoId=${anyAg.id}`,
        createdAt: anyAg.finishedAt ?? new Date(),
      },
    });

    await recomputePontuacaoAtleta(anyAg.atletaId);

    criadas++;
  }

  console.log({ ok: true, submissoesCriadas: criadas });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());