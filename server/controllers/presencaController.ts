import type { Response } from "express";
import { prisma } from "../prisma.js";

async function viewerPodeVerPresenca(viewerId: string, alvoId: string) {
  if (!viewerId || !alvoId) return false;
  if (viewerId === alvoId) return true;

  const segue = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId: viewerId, seguidoUsuarioId: alvoId },
    select: { id: true },
  });

  if (segue) {
  const seguidoPor = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId: alvoId, seguidoUsuarioId: viewerId },
    select: { id: true },
  });

  if (segue && seguidoPor) return true;
  }
  
  const [viewer, alvo] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: viewerId },
      select: {
        atleta: { select: { id: true } },
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    }),
    prisma.usuario.findUnique({
      where: { id: alvoId },
      select: {
        atleta: { select: { id: true } },
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    }),
  ]);

  const viewerAtletaId = viewer?.atleta?.id ?? null;
  const viewerProfessorId = viewer?.professor?.id ?? null;
  const viewerClubeId = viewer?.clube?.id ?? null;
  const viewerEscolinhaId = viewer?.escolinha?.id ?? null;

  const alvoAtletaId = alvo?.atleta?.id ?? null;
  const alvoProfessorId = alvo?.professor?.id ?? null;
  const alvoClubeId = alvo?.clube?.id ?? null;
  const alvoEscolinhaId = alvo?.escolinha?.id ?? null;

  const OR: any[] = [];

  if (viewerProfessorId && alvoAtletaId)
    OR.push({ professorId: viewerProfessorId, atletaId: alvoAtletaId, encerradoEm: null });
  if (alvoProfessorId && viewerAtletaId)
    OR.push({ professorId: alvoProfessorId, atletaId: viewerAtletaId, encerradoEm: null });

  if (viewerClubeId && alvoAtletaId)
    OR.push({ clubeId: viewerClubeId, atletaId: alvoAtletaId, encerradoEm: null });

  if (alvoClubeId && viewerAtletaId)
    OR.push({ clubeId: alvoClubeId, atletaId: viewerAtletaId, encerradoEm: null });

  if (viewerEscolinhaId && alvoAtletaId)
    OR.push({ escolinhaId: viewerEscolinhaId, atletaId: alvoAtletaId, encerradoEm: null });

  if (alvoEscolinhaId && viewerAtletaId)
    OR.push({ escolinhaId: alvoEscolinhaId, atletaId: viewerAtletaId, encerradoEm: null });

  if (OR.length === 0) return false;

  const vinculo = await prisma.relacaoTreinamento.findFirst({
    where: { OR },
    select: { id: true },
  });

  return !!vinculo;
}

export async function getPresenca(req: any, res: Response) {
  const alvoId = String(req.params.id || "").trim();
  const viewerId = String(req.userId || "").trim(); 

  if (!viewerId) return res.status(401).json({ message: "Não autenticado." });
  if (!alvoId) return res.status(400).json({ message: "ID inválido." });

  const allowed = await viewerPodeVerPresenca(viewerId, alvoId);
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