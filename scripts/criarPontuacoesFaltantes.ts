import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function corrigirPontuacoes() {
  try {
    const atletas = await prisma.atleta.findMany();

    for (const atleta of atletas) {
      const pontuacao = await prisma.pontuacaoAtleta.findUnique({
        where: { atletaId: atleta.id },
      });

      if (!pontuacao) {
        await prisma.pontuacaoAtleta.create({
          data: {
            atletaId: atleta.id,
            pontuacaoPerformance: 0,
            pontuacaoDisciplina: 0,
            pontuacaoResponsabilidade: 0,
          },
        });
        console.log(`Pontuação criada para atleta ${atleta.nome} (${atleta.id})`);
      }
    }
  } catch (err) {
    console.error("Erro ao corrigir pontuações:", err);
  } finally {
    await prisma.$disconnect();
  }
}

corrigirPontuacoes();
