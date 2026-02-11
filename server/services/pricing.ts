import { prisma } from "../prisma.js";

export async function computeMetodologiaAvulsaPricing(metodologiaId: string, _applyCoupons: boolean) {
  const m = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: { id: true, totalSemanas: true },
  });

  if (!m) throw new Error("Metodologia não encontrada");

  // Exemplo simples: preço por semana
  const semanas = m.totalSemanas ?? 0;
  const precoPorSemana = 9.9; // você define isso
  const valorFinal = Number((semanas * precoPorSemana).toFixed(2));

  return {
    valorFinal,
    breakdown: {
      semanas,
      precoPorSemana,
      subtotal: valorFinal,
      descontos: [],
      total: valorFinal,
    },
  };
}