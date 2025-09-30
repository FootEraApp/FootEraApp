import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function gerarSnapshotRanking() {
  const atletas = await prisma.pontuacaoAtleta.findMany({
    select: { atletaId: true, pontuacaoTotal: true },
    orderBy: { pontuacaoTotal: "desc" },
  });

  const snapshot = await prisma.rankingSnapshot.create({ data: { kind: "GLOBAL" } });
  await prisma.rankingRow.createMany({
    data: atletas.map((a, i) => ({
      snapshotId: snapshot.id,
      atletaId: a.atletaId,
      posicao: i + 1,
      pontuacao: a.pontuacaoTotal,
    })),
  });

  return snapshot.id;
}