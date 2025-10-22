import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.usuario.update({
    where: { email: "seu-admin@exemplo.com" },
    data: { tipo: "Admin" }, 
  });
  console.log("Feito!");
}
main().finally(() => prisma.$disconnect());