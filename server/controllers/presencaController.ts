import type { Response } from "express";
import { prisma } from "../prisma.js";
import { podeVerPresenca } from "@/utils/privacy.js";

export async function getPresenca(req: any, res: Response) {
  const alvoId = String(req.params.id || "").trim();
  const viewerId = String(req.userId || "").trim(); 

  if (!viewerId) return res.status(401).json({ message: "Não autenticado." });
  if (!alvoId) return res.status(400).json({ message: "ID inválido." });

  const allowed = await podeVerPresenca(viewerId, alvoId);
  if (!allowed) {
    return res.json({
      usuarioId: alvoId,
      isOnline: null,
      lastSeenAt: null,
      lastLoginAt: null,
      lastLogoutAt: null,
      privacyBlocked: true,        
      relationshipBlocked: true,   
    });
  }

  const u = await prisma.usuario.findUnique({
    where: { id: alvoId },
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

  if (!mostrarOnline) {
    return res.json({
      usuarioId: u.id,
      tipo: u.tipo,
      isOnline: false,
      lastSeenAt: null,
      lastLoginAt: null,
      lastLogoutAt: null,
      privacyBlocked: true,
      relationshipBlocked: false,
    });
  }

  const ONLINE_WINDOW_MS = 45_000;
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
    relationshipBlocked: false,
  });
}

export async function pingPresenca(req: any, res: Response) {
  const userId = req.userId; 
  if (!userId) return res.json({ ok: true });

  const now = new Date();

  await prisma.usuario.update({
    where: { id: userId },
    data: { lastSeenAt: now },
  });

  return res.json({ ok: true, usuarioId: userId, lastSeenAt: now });
}