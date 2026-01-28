// server/middlewares/treinoProgramadoGuard.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";

export async function requireAdminOrTreinoOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user; // vindo do authenticateToken
    const usuarioId = user?.id || user?.usuarioId;
    const tipo = String(user?.tipo || "").toLowerCase();

    if (!usuarioId) return res.status(401).json({ message: "Não autenticado." });

    // ✅ admin sempre pode
    if (tipo === "admin" || tipo === "administrador") return next();

    const treinoId = req.params.id;
    if (!treinoId) return res.status(400).json({ message: "Treino inválido." });

    // pega treino + colaboradores
    const treino = await prisma.treinoProgramado.findUnique({
      where: { id: treinoId },
      include: {
        professores: { select: { professorId: true } }, // tabela join (se existir)
      },
    });

    if (!treino) return res.status(404).json({ message: "Treino não encontrado." });

    // descobre a “entidade” do usuário logado (professor/clube/escolinha)
    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        tipo: true,
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    });

    if (!u) return res.status(401).json({ message: "Usuário inválido." });

    const professorId = u.professor?.id || null;
    const clubeId = u.clube?.id || null;
    const escolinhaId = u.escolinha?.id || null;

    const isOwner =
      (!!professorId && treino.professorId === professorId) ||
      (!!clubeId && treino.clubeId === clubeId) ||
      (!!escolinhaId && treino.escolinhaId === escolinhaId);

    const isColab =
      !!professorId &&
      Array.isArray(treino.professores) &&
      treino.professores.some((p) => p.professorId === professorId);

    if (!isOwner && !isColab) {
      return res.status(403).json({ message: "Você não tem permissão para editar este treino." });
    }

    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao validar permissão do treino." });
  }
}