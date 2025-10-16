import { PrismaClient } from "@prisma/client";
import { recomputePontuacaoAtleta } from "../server/services/recomputePontuacao";

const prisma = new PrismaClient();

(async () => {
  const atletas = await prisma.atleta.findMany({ select: { id: true, nome: true } });
  for (const a of atletas) {
    try {
      await recomputePontuacaoAtleta(a.id);
    } catch (e) {
      console.error("FAIL:", a.nome ?? a.id, e);
    }
  }
  await prisma.$disconnect();
})();
