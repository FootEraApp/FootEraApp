import { PrismaClient } from "@prisma/client";
import { recomputePontuacaoAtleta } from "../services/recomputePontuacao.js";

const prisma = new PrismaClient();

async function main() {
  const atletas = await prisma.atleta.findMany({
    select: {
      id: true,
      usuarioId: true,
      nome: true,
    },
  });

  console.log(
    `Recalculando ${atletas.length} atletas...`
  );

  for (const atleta of atletas) {
    try {
      await recomputePontuacaoAtleta(
        atleta.id
      );

      console.log(
        `OK: ${atleta.nome ?? atleta.id}`
      );
    } catch (error) {
      console.error(
        `ERRO: ${atleta.nome ?? atleta.id}`,
        error
      );
    }
  }

  console.log("Recomputação concluída.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });