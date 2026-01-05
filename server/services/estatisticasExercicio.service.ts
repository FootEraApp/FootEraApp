import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function recalcularEstatisticaExercicios(exercicioIds: string[]) {
  const ids = Array.from(new Set((exercicioIds || []).filter(Boolean)));
  if (ids.length === 0) return;

  await prisma.estatisticaExercicio.deleteMany({
    where: { exercicioId: { in: ids } },
  });

  await prisma.$executeRaw`
    WITH usage AS (
      SELECT
        tpe."exercicioId" AS exercicio_id,
        COUNT(DISTINCT tpe."treinoProgramadoId")::int AS inclusoes,
        MAX(tp."createdAt") AS ultimo_incluido_em
      FROM "TreinoProgramadoExercicio" tpe
      JOIN "TreinoProgramado" tp ON tp."id" = tpe."treinoProgramadoId"
      WHERE tpe."exercicioId" IS NOT NULL
        AND tpe."exercicioId" = ANY(${ids}::uuid[])
      GROUP BY tpe."exercicioId"
    )
    INSERT INTO "EstatisticaExercicio" ("exercicioId", "inclusoesEmTreinos", "ultimoIncluidoEm")
    SELECT exercicio_id, inclusoes, ultimo_incluido_em
    FROM usage
    ON CONFLICT ("exercicioId") DO UPDATE SET
      "inclusoesEmTreinos" = EXCLUDED."inclusoesEmTreinos",
      "ultimoIncluidoEm"   = EXCLUDED."ultimoIncluidoEm";
  `;
}