import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export async function removerTreinosExpirados() {
  const agora = new Date();

  const treinos = await prisma.treinoProgramado.findMany({
    select: {
      id: true,
      nome: true,
      createdAt: true,
      expiraEm: true,    
      naoExpira: true,   
    },
  });

  for (const treino of treinos) {
    if (treino.naoExpira) {
      console.log(`[SKIP] ${treino.nome} marcado como 'naoExpira'.`);
      continue;
    }

    const expiracao: Date | null = treino.expiraEm ? new Date(treino.expiraEm) : null;
    const expirado = !!(expiracao && agora > expiracao);

    if (!expirado) {
      console.log(`[OK] ${treino.nome} ainda válido.`);
      continue;
    }

    const temSub = await prisma.submissaoTreino.count({
      where: { treinoAgendado: { treinoProgramadoId: treino.id } },
    });

    if (temSub > 0) {
      console.log(
        `[SKIP] ${treino.nome} expirado mas tem ${temSub} submissão(ões) – não será deletado.`
      );
      continue;
    }

    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({
        where: { treinoProgramadoId: treino.id },
      }),
      prisma.treinoProgramado.delete({ where: { id: treino.id } }),
    ]);

    console.log(`[DEL] ${treino.nome} expirado e sem submissões – removido.`);
  }
}
