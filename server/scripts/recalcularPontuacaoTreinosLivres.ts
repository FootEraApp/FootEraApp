import { PrismaClient } from "@prisma/client";
import { recomputePontuacaoAtleta } from "../services/recomputePontuacao.js";

const prisma = new PrismaClient();

async function main() {
  const treinosLivres =
    await prisma.treinoLivre.findMany({
      select: {
        atletaId: true,
      },
    });

  const atletaIds = Array.from(
    new Set(
      treinosLivres
        .map((t) => t.atletaId)
        .filter(Boolean)
    )
  );

  console.log(
    `Recalculando ${atletaIds.length} atleta(s) com treino livre...`
  );

  for (const atletaId of atletaIds) {
    await recomputePontuacaoAtleta(
      atletaId
    );

    console.log(
      `✓ ${atletaId}`
    );
  }

  console.log(
    "Pontuações recalculadas com sucesso."
  );
}

main()
  .catch((err) => {
    console.error(
      "Erro ao recalcular pontuações:",
      err
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });