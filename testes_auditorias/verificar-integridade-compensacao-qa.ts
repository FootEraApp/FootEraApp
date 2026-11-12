import { prisma } from "./server/prisma.js";

try {
  const resultado = await prisma.$queryRaw<
    Array<{ id: string; tentativaId: string }>
  >`
    SELECT c."id", c."tentativaId"
    FROM "BillingCompensacaoConsultaRecuperacao" c
    LEFT JOIN "BillingCompensacaoTentativa" t
      ON t."id" = c."tentativaId"
     AND t."compensacaoId" = c."compensacaoId"
    WHERE t."id" IS NULL
  `;

  console.log("EVIDENCIAS_INCONSISTENTES:", resultado.length);
  console.log(resultado);
} finally {
  await prisma.$disconnect();
}
