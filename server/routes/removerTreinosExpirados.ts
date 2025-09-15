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
      continue;
    }

    const expiracao: Date | null = treino.expiraEm ? new Date(treino.expiraEm) : null;
    const expirado = !!(expiracao && agora > expiracao);

    if (!expirado) {
      continue;
    }

    const temSub = await prisma.submissaoTreino.count({
      where: { treinoAgendado: { treinoProgramadoId: treino.id } },
    });

    if (temSub > 0) {

      continue;
    }

    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({
        where: { treinoProgramadoId: treino.id },
      }),
      prisma.treinoProgramado.delete({ where: { id: treino.id } }),
    ]);

  }
}