import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.cupom.upsert({
        where: { codigo: "FOOTERA10" },
        update: {},
        create: {
            codigo: "FOOTERA10",
            tipo: "PERCENTUAL",
            descontoPerc: 10,
            ativo: true,
        }
    });
    await prisma.cupom.upsert({
        where: { codigo: "PRESENTE-ATLETA" },
        update: {},
        create: {
            codigo: "PRESENTE-ATLETA",
            tipo: "PRESENTE",
            plano: "ATLETA_PRO",
            periodicidade: "Mensal",
            usosMax: 1,
            ativo: true,
        }
    });
    console.log('✅ Seed billing executado com sucesso!');
}
main().finally(() => prisma.$disconnect());
