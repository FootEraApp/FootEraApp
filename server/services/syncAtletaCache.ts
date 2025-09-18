import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function syncAtletaCache(atletaId: string) {
  const [rel, pa, ea] = await Promise.all([
    prisma.relacaoTreinamento.findFirst({
      where: { atletaId, OR: [{ clubeId: { not: null } }, { escolinhaId: { not: null } }] },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.pontuacaoAtleta.findUnique({ where: { atletaId } }),
    prisma.estatisticaAtleta.findUnique({ where: { atletaId } }),
  ]);

  const somaPA =
    pa ? (pa.pontuacaoPerformance ?? 0) + (pa.pontuacaoDisciplina ?? 0) + (pa.pontuacaoResponsabilidade ?? 0) : undefined;

  const pontos = pa?.pontuacaoTotal ?? somaPA ?? ea?.totalPontos ?? 0;

  await prisma.atleta.update({
    where: { id: atletaId },
    data: {
      clubeId: rel?.clubeId ?? undefined,
      escolinhaId: rel?.escolinhaId ?? undefined,
      pontosTotal: pontos,
    },
  });
}