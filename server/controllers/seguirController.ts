import { Request, Response, RequestHandler } from "express";
import {  NotificacaoTipo } from "@prisma/client";
import { recomputeAndEmitBadge } from "./notificacoesController.js"; 
import { prisma } from "../prisma.js";

interface AuthenticatedRequest extends Request {
  userId: string;
}

async function criarNotifEAtualizarBadge(params: {
  usuarioId: string;            
  actorId?: string | null;     
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  link?: string | null;
}) {
  const { usuarioId, actorId, tipo, titulo, mensagem, link } = params;

  await prisma.notificacao.create({
    data: {
      usuarioId,
      actorId: actorId ?? null,
      tipo,
      titulo,
      mensagem,
      link: link ?? null,
      lida: false,
    },
  });

  try {
    await recomputeAndEmitBadge(usuarioId);
  } catch {
  }
}

export const seguirUsuario: RequestHandler = async (req: any, res) => {
  const seguidorUsuarioId = String(req.userId || "").trim();
  const seguidoUsuarioId = String(req.body?.seguidoUsuarioId || "").trim();

  if (!seguidorUsuarioId) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  if (!seguidoUsuarioId) {
    return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  }

  if (seguidoUsuarioId === seguidorUsuarioId) {
    return res.status(400).json({ message: "Não é permitido seguir a si mesmo." });
  }

  const seguidor = await prisma.usuario.findUnique({
    where: { id: seguidorUsuarioId },
    select: { id: true, nomeDeUsuario: true },
  });

  if (!seguidor) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  const seguido = await prisma.usuario.findUnique({
    where: { id: seguidoUsuarioId },
    select: { id: true, nomeDeUsuario: true },
  });

  if (!seguido) {
    return res.status(404).json({ message: "Usuário a ser seguido não encontrado." });
  }

  const jaSegue = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId, seguidoUsuarioId },
    select: { id: true },
  });

  if (jaSegue) {
    return res.status(409).json({ message: "Você já segue este usuário." });
  }

  const existente = await prisma.notificacao.findFirst({
    where: {
      usuarioId: seguidoUsuarioId,
      actorId: seguidorUsuarioId,
      tipo: NotificacaoTipo.FOLLOW,
      lida: false,
    },
  });

  if (existente) {
    return res.status(200).json({ ok: true, pendente: true });
  }

  await criarNotifEAtualizarBadge({
    usuarioId: seguidoUsuarioId,
    actorId: seguidorUsuarioId,
    tipo: NotificacaoTipo.FOLLOW,
    titulo: "Solicitação para seguir",
    mensagem: `@${seguidor.nomeDeUsuario ?? "usuario"} quer te seguir`,
    link: `/perfil/${seguidorUsuarioId}`,
  });

  return res.status(201).json({ ok: true, pendente: true });
};

export const deixarDeSeguir: RequestHandler = async (req: any, res) => {
  const seguidorUsuarioId = req.userId!;
  const seguidoUsuarioId =
    (req.params as any).seguidoUsuarioId || (req.body as any).seguidoUsuarioId;

  if (!seguidoUsuarioId) {
    return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  }
  if (seguidoUsuarioId === seguidorUsuarioId) {
    return res.status(400).json({ message: "Operação inválida." });
  }

  const [seguidor, seguido] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: seguidorUsuarioId },
      select: { id: true, nomeDeUsuario: true },
    }),
    prisma.usuario.findUnique({
      where: { id: seguidoUsuarioId },
      select: { id: true, nomeDeUsuario: true },
    }),
  ]);

  const del = await prisma.seguidor.deleteMany({
    where: { seguidorUsuarioId, seguidoUsuarioId },
  });

  if (del.count === 0) {
    return res.status(404).json({ message: "Relação de follow não encontrada." });
  }

  if (seguido && seguidor) {
    await criarNotifEAtualizarBadge({
      usuarioId: seguidoUsuarioId,
      actorId: seguidorUsuarioId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Atualização",
      mensagem: `@${seguidor.nomeDeUsuario} parou de te seguir`,
      link: `/perfil/${seguidorUsuarioId}`,
    });
  }
  return res.sendStatus(204);
};

export const removerSeguidor: RequestHandler = async (req: any, res) => {
  const meuUsuarioId = req.userId!;
  const seguidorUsuarioId = String(req.params?.seguidorUsuarioId || "").trim();

  if (!seguidorUsuarioId) {
    return res.status(400).json({ message: "seguidorUsuarioId é obrigatório" });
  }
  if (seguidorUsuarioId === meuUsuarioId) {
    return res.status(400).json({ message: "Operação inválida." });
  }

  const del = await prisma.seguidor.deleteMany({
    where: { seguidorUsuarioId, seguidoUsuarioId: meuUsuarioId },
  });

  if (!del.count) {
    return res.status(404).json({ message: "Esse usuário não te segue." });
  }

  const eu = await prisma.usuario.findUnique({
    where: { id: meuUsuarioId },
    select: { nomeDeUsuario: true },
  });

  if (eu) {
    await criarNotifEAtualizarBadge({
      usuarioId: seguidorUsuarioId,
      actorId: meuUsuarioId,
      tipo: NotificacaoTipo.FOLLOW_REMOVED,
      titulo: "Você foi removido",
      mensagem: `@${eu.nomeDeUsuario} removeu você dos seguidores`,
      link: `/perfil/${meuUsuarioId}`,
    });
  }
  return res.json({ ok: true });
};

export async function listarSeguindo(req: Request, res: Response) {
  const seguidorUsuarioId = (req as any).user?.id || (req as any).userId;
  if (!seguidorUsuarioId) return res.status(401).json({ error: "Não autenticado." });

  const rows = await prisma.seguidor.findMany({
    where: { seguidorUsuarioId },
    select: { seguidoUsuarioId: true },
    orderBy: { seguidoUsuarioId: "asc" },
  });

  return res.json(rows.map((r) => ({ seguidoUsuarioId: r.seguidoUsuarioId })));
}

export async function statusSeguidor(req: Request, res: Response) {
  const seguidorUsuarioId = (req as any).user?.id || (req as any).userId;
  const seguidoUsuarioId = String(req.query.seguidoUsuarioId || "");

  if (!seguidorUsuarioId) return res.status(401).json({ error: "Não autenticado." });
  if (!seguidoUsuarioId) return res.status(400).json({ error: "seguidoUsuarioId é obrigatório." });

  const exists = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId, seguidoUsuarioId },
    select: { id: true },
  });

  return res.json({ seguindo: !!exists, isFollowing: !!exists });
}

export async function minhaRede(req: any, res: Response) {
  try {
    const usuarioId = (req as any).userId as string;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const seguidos = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: usuarioId },
      include: { seguidoUsuario: { select: { id: true, nome: true, foto: true } } },
    });

    const seguidores = await prisma.seguidor.findMany({
      where: { seguidoUsuarioId: usuarioId },
      include: { seguidorUsuario: { select: { id: true, nome: true, foto: true } } },
    });

    const seguindo = seguidos.map((s) => s.seguidoUsuario);
    const seguindoSet = new Set(seguindo.map((u) => u.id));

    const seguidoresFmt = seguidores.map((s) => ({
      ...s.seguidorUsuario,
      isSeguindo: seguindoSet.has(s.seguidorUsuario.id),
    }));

    return res.json({ seguindo, seguidores: seguidoresFmt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar minha rede" });
  }
}

export const aceitarSeguidor: RequestHandler = async (req: any, res) => {
  const seguidoUsuarioId = req.userId!;
  const { notificacaoId, seguidorUsuarioId } = req.body;

  const actorId = String(seguidorUsuarioId || "").trim();

  if (!actorId) {
    return res.status(400).json({ message: "seguidorUsuarioId é obrigatório." });
  }

  await prisma.seguidor.upsert({
    where: {
      seguidorUsuarioId_seguidoUsuarioId: {
        seguidorUsuarioId: actorId,
        seguidoUsuarioId,
      },
    },
    update: {},
    create: {
      seguidorUsuarioId: actorId,
      seguidoUsuarioId,
    },
  });

  if (notificacaoId) {
    await prisma.notificacao.deleteMany({
      where: { id: String(notificacaoId), usuarioId: seguidoUsuarioId },
    });
  }

  await criarNotifEAtualizarBadge({
    usuarioId: actorId,
    actorId: seguidoUsuarioId,
    tipo: NotificacaoTipo.GENERICA,
    titulo: "Solicitação aceita",
    mensagem: "Sua solicitação para seguir foi aceita.",
    link: `/perfil/${seguidoUsuarioId}`,
  });

  await recomputeAndEmitBadge(seguidoUsuarioId);

  return res.json({ ok: true });
};

export const recusarSeguidor: RequestHandler = async (req: any, res) => {
  const seguidoUsuarioId = req.userId!;
  const { notificacaoId, seguidorUsuarioId } = req.body;

  if (notificacaoId) {
    await prisma.notificacao.deleteMany({
      where: { id: String(notificacaoId), usuarioId: seguidoUsuarioId },
    });
  }

  if (seguidorUsuarioId) {
    await criarNotifEAtualizarBadge({
      usuarioId: String(seguidorUsuarioId),
      actorId: seguidoUsuarioId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Solicitação recusada",
      mensagem: "Sua solicitação para seguir foi recusada.",
      link: `/perfil/${seguidoUsuarioId}`,
    });
  }

  await recomputeAndEmitBadge(seguidoUsuarioId);

  return res.json({ ok: true });
};