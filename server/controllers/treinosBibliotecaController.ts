import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

type AuthenticatedRequest = Request & { userId?: string };

// GET /api/treinos/biblioteca
// Usa somente o usuário autenticado; nunca aceita usuarioId enviado pelo cliente.
export async function listarMinhaBiblioteca(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();
  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  try {
    const salvos = await prisma.treinoSalvo.findMany({
      where: {
        usuarioId,
        professorId: null,
        clubeId: null,
        escolinhaId: null,
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
      select: {
        id: true,
        titulo: true,
        treinoProgramadoId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const ids = [...new Set(salvos.map((salvo) => salvo.treinoProgramadoId))];
    const programados = ids.length
      ? await prisma.treinoProgramado.findMany({
          where: { id: { in: ids } },
          include: {
            exercicios: {
              include: {
                exercicio: true,
                exercicioPersonalizado: true,
                exercicioTemporario: true,
              },
            },
            professores: {
              include: { professor: { select: { id: true, nome: true } } },
            },
            Professor: { select: { id: true, nome: true } },
            clube: { select: { id: true, nome: true } },
            escolinha: { select: { id: true, nome: true } },
            sessaoTreino: true,
          },
        })
      : [];

    const porId = new Map(programados.map((treino) => [treino.id, treino]));
    const items = salvos.flatMap((salvo) => {
      const treinoProgramado = porId.get(salvo.treinoProgramadoId);
      return treinoProgramado ? [{ ...salvo, treinoProgramado }] : [];
    });

    return res.json({ items });
  } catch (erro) {
    console.error("listarMinhaBiblioteca", erro);
    return res.status(500).json({ message: "Erro ao carregar treinos salvos." });
  }
}
