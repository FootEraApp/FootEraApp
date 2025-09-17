import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";

const prisma = new PrismaClient();

export async function getBadge(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const [pendSolic, unreadMsgs] = await Promise.all([
      prisma.solicitacaoTreino.count({
        where: {
          destinatarioId: userId,
          OR: [
            { status: null },
            { status: { in: ["Pendente", "pendente", "Aguardando", "aguardando", "Pending", "pending"] } },
          ],
        },
      }),
      prisma.mensagem.count({ where: { paraId: userId, lida: false } }),
    ]);

    res.json({
      total: pendSolic,
      solicitacoes: pendSolic,
      mensagens: unreadMsgs,
    });
  } catch (e) {
    console.error("getBadge error:", e);
    res.json({ total: 0, solicitacoes: 0, mensagens: 0 });
  }
}

export async function recomputeAndEmitBadge(userId: string) {
  const [pendSolic, unreadMsgs] = await Promise.all([
    prisma.solicitacaoTreino.count({
      where: {
        destinatarioId: userId,
        OR: [
          { status: null },
          { status: { in: ["Pendente","pendente","Aguardando","aguardando","Pending","pending"] } },
        ],
      },
    }),
    prisma.mensagem.count({ where: { paraId: userId, lida: false } }),
  ]);

  getIO()?.to(userId).emit("badge:update", {
    total: pendSolic + unreadMsgs,
    solicitacoes: pendSolic,
    mensagens: unreadMsgs,
  });
}