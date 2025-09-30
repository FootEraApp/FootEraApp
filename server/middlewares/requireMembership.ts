import { PrismaClient } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

const prisma = new PrismaClient();

export async function requireMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = (req as any).userId as string | undefined;
    const { clubeId, escolinhaId } = req.params as { clubeId?: string; escolinhaId?: string };
    if (!usuarioId) return res.status(401).json({ error: "Não autenticado" });

    if (clubeId) {
      const ok = await prisma.clube.findFirst({ where: { id: clubeId, usuarioId }, select: { id: true } });
      if (!ok) return res.status(403).json({ error: "Sem acesso ao clube" });
    } else if (escolinhaId) {
      const ok = await prisma.escolinha.findFirst({ where: { id: escolinhaId, usuarioId }, select: { id: true } });
      if (!ok) return res.status(403).json({ error: "Sem acesso à escolinha" });
    } else {
      return res.status(400).json({ error: "Informe clubeId ou escolinhaId na rota" });
    }

    next();
  } catch (e) {
    console.error("requireMembership erro:", e);
    res.status(500).json({ error: "Falha na verificação de acesso" });
  }
}