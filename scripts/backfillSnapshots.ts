import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.submissaoTreino.findMany({
    where: { aprovado: true },
    include: { treinoAgendado: { include: { treinoProgramado: true } } },
  });

  for (const s of subs) {
    const tp = s.treinoAgendado?.treinoProgramado;
    await prisma.submissaoTreino.update({
      where: { id: s.id },
      data: {
        treinoTituloSnapshot: s.treinoTituloSnapshot ?? (tp?.nome ?? s.treinoAgendado?.titulo ?? "Treino"),
        tipoTreinoSnapshot:   s.tipoTreinoSnapshot   ?? (tp?.tipoTreino ?? null),
        duracaoMinutos:       s.duracaoMinutos       ?? (tp?.duracao ?? 0),
        pontuacaoSnapshot:    s.pontuacaoSnapshot    ?? (tp?.pontuacao ?? 0),
        pontosCreditados:     s.pontosCreditados     ?? (tp?.pontuacao ?? 0),
      },
    });
  }

  console.log(`Backfill concluído para ${subs.length} submissões.`);
}

main().finally(() => prisma.$disconnect());