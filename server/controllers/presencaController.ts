import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function getPresenca(req: Request, res: Response) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      lastSeenAt: true,
      lastLoginAt: true,
      lastLogoutAt: true,
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

  const ONLINE_WINDOW_MS = 2 * 60_000; // 2 min
  const now = Date.now();
  const lastSeen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;

  const isOnline = !!lastSeen && now - lastSeen <= ONLINE_WINDOW_MS;

  return res.json({
    usuarioId: u.id,
    tipo: u.tipo,
    isOnline,
    lastSeenAt: u.lastSeenAt,
    lastLoginAt: u.lastLoginAt,
    lastLogoutAt: u.lastLogoutAt,
  });
}