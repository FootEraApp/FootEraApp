import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.submissaoTreino.findMany({
    where: {
      aprovado: true as any,
      AND: [
        { OR: [{ pontosCreditados: null }, { pontosCreditados: 0 }] },
        { OR: [{ pontuacaoSnapshot: null }, { pontuacaoSnapshot: 0 }] },
      ],
    },
    include: {
      treinoAgendado: {
        include: {
          treinoProgramado: { select: { pontuacao: true } },
        },
      },
    },
  });

  let atualizadas = 0;

  for (const s of subs) {
    const base = s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    if (base > 0) {
      await prisma.submissaoTreino.update({
        where: { id: s.id },
        data: { pontuacaoSnapshot: base }, 
      });
      atualizadas++;
    }
  }

  console.log(`Backfill concluído. Submissões atualizadas: ${atualizadas}/${subs.length}`);
}

main().finally(() => prisma.$disconnect());