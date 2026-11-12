import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433"
  ) {
    throw new Error("Somente banco local.");
  }

  const { prisma } = await import("../prisma.js");

  try {
    const professorId =
      "45c763b5-3f9e-4f90-bd49-6ea81b8413a2";

    const relacoes =
      await prisma.relacaoTreinamento.findMany({
        where: { professorId },
        select: {
          id: true,
          clubeId: true,
          escolinhaId: true,
          atletaId: true,
          ativo: true,
          encerradoEm: true,
        },
      });

    console.table(relacoes);

    console.log(
      "Relações ativas:",
      relacoes.filter(
        (relacao) =>
          relacao.ativo &&
          !relacao.encerradoEm
      ).length
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);