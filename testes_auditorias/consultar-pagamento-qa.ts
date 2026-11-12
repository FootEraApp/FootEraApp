
import { prisma } from "./server/prisma.js";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("Banco QA incorreto");
  }

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  if (banco[0]?.nome !== "footera_billing_qa") {
    throw new Error("Banco conectado incorreto");
  }

  const id = "600af3c0-b4a2-4cba-98b0-160aa69d242f";

  const pagamento = await prisma.pagamento.findUnique({
    where: { id },
    include: {
      beneficios: true,
    },
  });

  console.dir({ pagamento }, { depth: 5 });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
