import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function removerTreinosExpirados() {
  const agora = new Date();

  const treinos = await prisma.treinoProgramado.findMany();

  for (const treino of treinos) {
    if (treino.duracao && treino.createdAt) {
      const expiracao = new Date(treino.createdAt.getTime() + treino.duracao * 60000); 

      if (agora > expiracao) {
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