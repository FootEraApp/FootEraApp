import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.atleta.findMany({
    where: { nome: { startsWith: "aaaaa", mode: "insensitive" } },
    select: { id: true, nome: true, clubeId: true, escolinhaId: true, pontosTotal: true }
  });
  console.table(rows);
}
main().finally(() => prisma.$disconnect());
