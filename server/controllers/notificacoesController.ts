import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";

const prisma = new PrismaClient();

export async function listarMinhasNotificacoes(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const rows = await prisma.notificacao.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: {
            id: true,
            nomeDeUsuario: true,
            nome: true,
            foto: true,
          },
        },
      },
    });

    return res.json({ items: rows });
  } catch (e) {
    console.error("[listarMinhasNotificacoes]", e);
    return res.status(500).json({ error: "Erro ao listar notificações" });
  }
}

export async function getBadge(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const [pendSolic, unreadMsgs, totalNotifs] = await Promise.all([
      prisma.solicitacaoTreino.count({
        where: {
          destinatarioId: userId,
          OR: [
            { status: null },
            {
              status: {
                in: [
                  "Pendente",
                  "pendente",
                  "Aguardando",
                  "aguardando",
                  "Pending",
                  "pending",
                ],
              },
            },
          ],
        },
      }),
      prisma.mensagem.count({ where: { paraId: userId, lida: false } }),
      prisma.notificacao.count({ where: { usuarioId: userId } }),
    ]);

    const totalNotificacoes = totalNotifs + pendSolic;

    return res.json({
      totalNotificacoes,
      notificacoes: totalNotifs,
      solicitacoes: pendSolic,
      total: totalNotificacoes,
      mensagens: unreadMsgs,
    });
  } catch (e) {
    console.error("getBadge error:", e);
    return res.json({
      totalNotificacoes: 0,
      notificacoes: 0,
      solicitacoes: 0,
      total: 0,
      mensagens: 0,
    });
  }
}

export async function recomputeAndEmitBadge(userId: string) {
  const [pendSolic, unreadMsgs, totalNotifs] = await Promise.all([
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
    prisma.notificacao.count({ where: { usuarioId: userId } }),
  ]);

  getIO()?.to(userId).emit("badge:update", {
    totalNotificacoes: totalNotifs + pendSolic,
    notificacoes: totalNotifs,
    solicitacoes: pendSolic,
    mensagens: unreadMsgs,
  });
}

export async function deletarNotificacao(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const del = await prisma.notificacao.deleteMany({
      where: { id, usuarioId: userId },
    });

    if (!del.count) {
      await recomputeAndEmitBadge(userId);
      return res.status(404).json({ error: "Notificação não encontrada" });
    }

    await recomputeAndEmitBadge(userId);

    return res.json({ ok: true });
  } catch (e) {
    console.error("[deletarNotificacao]", e);
    return res.status(500).json({ error: "Erro ao deletar notificação" });
  }
}