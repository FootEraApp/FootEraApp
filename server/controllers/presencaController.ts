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
      configuracoesPrivacidade: true,
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

  const priv: any =
    u.configuracoesPrivacidade && typeof u.configuracoesPrivacidade === "object"
      ? u.configuracoesPrivacidade
      : {};

  const mostrarOnline = priv.mostrarOnline ?? true;

  // ✅ Se desmarcou, não expõe presença pra ninguém (nem pro próprio usuário)
  if (!mostrarOnline) {
    return res.json({
      usuarioId: u.id,
      tipo: u.tipo,
      isOnline: false,
      lastSeenAt: null,
      lastLoginAt: null,
      lastLogoutAt: null,
      privacyBlocked: true,
    });
  }

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
    privacyBlocked: false,
  });
}

// ✅ NOVO: ping do usuário logado
export async function pingPresenca(req: any, res: Response) {
  const userId = req.userId; // vem do authenticateToken
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  const now = new Date();

  await prisma.usuario.update({
    where: { id: userId },
    data: { lastSeenAt: now },
  });

  return res.json({ ok: true, usuarioId: userId, lastSeenAt: now });
}