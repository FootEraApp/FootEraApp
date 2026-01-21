import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";
import { prisma } from "../prisma.js";

async function getNotifPrefs(userId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { configuracoesNotificacoes: true },
  });

  const raw: any = u?.configuracoesNotificacoes || {};
  return {
    notifMensagens: raw.notifMensagens ?? true,
    notifTreinos: raw.notifTreinos ?? true,
    notifEventos: raw.notifEventos ?? true,
    notifMarketing: raw.notifMarketing ?? false,
  };
}

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

    const prefs = await getNotifPrefs(userId);
    const filtered = rows.filter((n: any) => {
      const t = String(n.tipo ?? n.categoria ?? n.kind ?? "").toLowerCase();

      if (t.includes("mens")) return prefs.notifMensagens;
      if (t.includes("trein") || t.includes("solicit")) return prefs.notifTreinos;
      if (t.includes("event")) return prefs.notifEventos;
      if (t.includes("market") || t.includes("promo")) return prefs.notifMarketing;

      return true; // se não tiver tipo claro, não some com a notificação
    });

    return res.json({ items: filtered });
  } catch (e) {
    console.error("[listarMinhasNotificacoes]", e);
    return res.status(500).json({ error: "Erro ao listar notificações" });
  }
}

export async function getBadge(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const prefs = await getNotifPrefs(userId);
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
    const solicitacoesCount = prefs.notifTreinos ? pendSolic : 0;
    const mensagensCount = prefs.notifMensagens ? unreadMsgs : 0;

    // totalNotifs (notificacoes gerais) você pode manter,
    // ou zerar também se você tiver tipos e quiser respeitar.
    // Por segurança, aqui vou manter "notificacoes" como está:
    const notificacoesCount = totalNotifs;

    const totalNotificacoes = notificacoesCount + solicitacoesCount;

    return res.json({
      totalNotificacoes,
      notificacoes: notificacoesCount,
      solicitacoes: solicitacoesCount,
      total: totalNotificacoes,
      mensagens: mensagensCount,
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
  const prefs = await getNotifPrefs(userId);
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

  const solicitacoesCount = prefs.notifTreinos ? pendSolic : 0;
  const mensagensCount = prefs.notifMensagens ? unreadMsgs : 0;

  getIO()?.to(userId).emit("badge:update", {
    totalNotificacoes: totalNotifs + solicitacoesCount,
    notificacoes: totalNotifs,
    solicitacoes: solicitacoesCount,
    mensagens: mensagensCount,
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