import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.id, a.nome, a."pontosTotal",
           pa."pontuacaoTotal", pa."pontuacaoPerformance",
           pa."pontuacaoDisciplina", pa."pontuacaoResponsabilidade"
    FROM "Atleta" a
    LEFT JOIN "PontuacaoAtleta" pa ON pa."atletaId" = a.id
    ORDER BY a."dataCriacao" DESC
    LIMIT 10;
  `);
  console.table(rows);
}
main().finally(() => prisma.$disconnect());
