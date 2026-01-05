import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function rebuildEstatisticaExercicios(req: Request, res: Response) {
  try {
    await prisma.$executeRaw`
      WITH usage AS (
        SELECT
          tpe."exercicioId" AS exercicio_id,
          COUNT(DISTINCT tpe."treinoProgramadoId")::int AS inclusoes,
          MAX(tp."createdAt") AS ultimo_incluido_em
        FROM "TreinoProgramadoExercicio" tpe
        JOIN "TreinoProgramado" tp ON tp."id" = tpe."treinoProgramadoId"
        WHERE tpe."exercicioId" IS NOT NULL
        GROUP BY tpe."exercicioId"
      )
      INSERT INTO "EstatisticaExercicio" ("exercicioId", "inclusoesEmTreinos", "ultimoIncluidoEm")
      SELECT exercicio_id, inclusoes, ultimo_incluido_em
      FROM usage
      ON CONFLICT ("exercicioId") DO UPDATE SET
        "inclusoesEmTreinos" = EXCLUDED."inclusoesEmTreinos",
        "ultimoIncluidoEm"   = EXCLUDED."ultimoIncluidoEm";
    `;

    return res.json({ ok: true, message: "EstatisticaExercicio recalculada com sucesso." });
  } catch (e) {
    console.error("rebuildEstatisticaExercicios", e);
    return res.status(500).json({ ok: false, error: "Falha ao recalcular estatísticas." });
  }
}