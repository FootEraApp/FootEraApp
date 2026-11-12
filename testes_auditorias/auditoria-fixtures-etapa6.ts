const { prisma } = await import("./server/prisma.js");

const ids = [
  "dd57c0fd-0d04-4cca-b531-9fd75022cb46",
  "371c2ca9-6312-42ae-923a-6dffde0cff0c",
  "7ddee043-24b2-4f80-b5e5-9ac0eeeca40e",
];

try {
  const db = await prisma.$queryRaw`
    SELECT current_database() AS nome
  `;

  if (db[0]?.nome !== "footera_billing_qa") {
    throw new Error("BANCO_QA_INCORRETO");
  }

  for (const id of ids) {
    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        provider: true,
        providerRef: true,
        valor: true,
        usuarioId: true,
        plano: true,
        meta: true,
      },
    });

    const beneficios = await prisma.pagamentoBeneficio.count({
      where: { pagamentoId: id },
    });

    const operacoes = await prisma.billingCheckoutOperacao.count({
      where: { pagamentoId: id },
    });

    const reservas = await prisma.cupomReserva.count({
      where: { pagamentoId: id },
    });

    const resgates = await prisma.cupomResgate.count({
      where: { pagamentoId: id },
    });

    console.log({
      id,
      pagamento,
      beneficios,
      operacoes,
      reservas,
      resgates,
    });
  }
} finally {
  await prisma.$disconnect();
}
