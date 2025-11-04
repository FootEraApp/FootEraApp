import { PrismaClient} from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export async function getTopExercicios(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 10);
  const rows = await prisma.estatisticaExercicio.findMany({
    orderBy: { inclusoesEmTreinos: "desc" },
    take: limit,
    include: {
      exercicio: { select: { id: true, nome: true, codigo: true, nivel: true } },
      recomendadoPorProfessor: { select: { id: true, nome: true, codigo: true } },
      ultimoProfessor: { select: { id: true, nome: true, codigo: true } },
    },
  });
  res.json(rows);
}

export async function getTreinoStats(req: Request, res: Response) {
  const { id } = req.params;
  const [agg, porProf] = await Promise.all([
    prisma.estatisticaTreino.findUnique({ where: { treinoId: id } }),
    prisma.treinoProfessorUso.findMany({
      where: { treinoId: id },
      orderBy: { usos: "desc" },
      include: { professor: { select: { id: true, nome: true, codigo: true } } },
    }),
  ]);
  res.json({ treinoId: id, agregado: agg ?? null, porProfessor: porProf });
}