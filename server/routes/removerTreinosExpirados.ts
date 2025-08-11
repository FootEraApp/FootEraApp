import { prisma } from "../lib/prisma";

export async function removerTreinosExpirados() {
  const agora = new Date();

  const treinos = await prisma.treinoProgramado.findMany({
    select: { id: true, nome: true, createdAt: true, duracao: true },
  });

  for (const treino of treinos) {
    if (treino.duracao && treino.createdAt) {
      const expiracao = new Date(treino.createdAt.getTime() + treino.duracao * 60000); 

      if (agora > expiracao) {
      await prisma.treinoProgramadoExercicio.deleteMany({
        where: { treinoProgramadoId: treino.id },
      });

      await prisma.treinoProgramado.delete({
        where: { id: treino.id },
      });

      console.log(`Treino ${treino.nome} removido por expiração.`);
    } 
   }
  }
}

removerTreinosExpirados()
  .catch((e) => {
    console.error("Erro ao remover treinos expirados:", e);
  })
  .finally(() => {
    prisma.$disconnect();
  });