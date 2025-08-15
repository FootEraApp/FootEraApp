import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export async function incTreino(atletaId: string, minutos: number, categoria: string) {
  const incCat: any = {};
  if (categoria?.toLowerCase() === 'físico' || categoria?.toLowerCase() === 'fisico') incCat.fisico = { increment: 1 };
  if (categoria?.toLowerCase() === 'técnico' || categoria?.toLowerCase() === 'tecnico') incCat.tecnico = { increment: 1 };
  if (categoria?.toLowerCase() === 'tático'  || categoria?.toLowerCase() === 'tatico')  incCat.tatico = { increment: 1 };
  if (categoria?.toLowerCase() === 'mental') incCat.mental = { increment: 1 };

  await prisma.estatisticaAtleta.upsert({
    where: { atletaId },
    create: {
      atletaId,
      totalTreinos: 1,
      horasTreinadas: minutos / 60,
      ...incCat,
    },
    update: {
      totalTreinos: { increment: 1 },
      horasTreinadas: { increment: minutos / 60 },
      ...Object.fromEntries(Object.entries(incCat).map(([k,v]) => [k, (v as any).increment ? v : { increment: 1 }]))
    }
  });
}

export async function incDesafio(atletaId: string, pontos: number) {
  await prisma.estatisticaAtleta.upsert({
    where: { atletaId },
    create: { atletaId, totalDesafios: 1, totalPontos: pontos },
    update: { totalDesafios: { increment: 1 }, totalPontos: { increment: pontos } }
  });
}
