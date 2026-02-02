import { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function adminRestaurarConta(req: Request, res: Response) {
  const { id } = req.params;

  const usuario = await prisma.usuario.findUnique({
    where: { id: String(id) },
    select: { id: true, deletedAt: true, deleteScheduledAt: true },
  });

  if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });
  if (!usuario.deletedAt) return res.status(400).json({ message: "Conta não está na lixeira." });

  const updated = await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      deletedAt: null,
      deleteScheduledAt: null,
      tokenVersion: { increment: 1 },
      lastLogoutAt: null,
    },
    select: { id: true },
  });

  return res.json({ ok: true, message: "Conta restaurada pelo admin.", usuario: updated });
}