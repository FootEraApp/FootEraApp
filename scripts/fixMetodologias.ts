//fixmetodologias

import { prisma } from "../server/prisma.js";

async function main() {
  const updated = await prisma.metodologia.updateMany({
    where: {
      OR: [
        { tipo: null as any },
        { estruturaTipo: null as any },
      ],
    } as any,
    data: {
      tipo: "TRILHAS_TREINO" as any,
      estruturaTipo: "TRILHA" as any,
    },
  });

  console.log("Metodologias atualizadas:", updated.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });