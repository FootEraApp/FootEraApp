import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function pick<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as T;
}

async function resolveOwnerFromUsuario(
  usuarioId: string
): Promise<
  | { professorId: string; escolinhaId?: never; clubeId?: never }
  | { professorId?: never; escolinhaId: string; clubeId?: never }
  | { professorId?: never; escolinhaId?: never; clubeId: string }
  | null
> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });
  if (!usuario) return null;

  if (usuario.tipo === "Professor") {
    const r = await prisma.professor.findUnique({ where: { usuarioId } });
    return r ? { professorId: r.id } : null;
  }
  if (usuario.tipo === "Escolinha") {
    const r = await prisma.escolinha.findUnique({ where: { usuarioId } });
    return r ? { escolinhaId: r.id } : null;
  }
  if (usuario.tipo === "Clube") {
    const r = await prisma.clube.findUnique({ where: { usuarioId } });
    return r ? { clubeId: r.id } : null;
  }
  return null;
}

export async function listarObservados(req: Request, res: Response) {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const owner = await resolveOwnerFromUsuario(userId);
    if (!owner) {
      return res.json([]);
    }

    const lista = await prisma.atletaObservado.findMany({
      where: pick(owner),
      include: {
        atleta: { select: { usuarioId: true } },
      },
    });

    const out = lista.map((x) => ({
      atletaId: x.atletaId,
      id: x.atleta?.usuarioId,
      usuarioId: x.atleta?.usuarioId,
      atletaUsuarioId: x.atleta?.usuarioId,
    }));

    return res.json(out);
  } catch (e) {
    return res.json([]);
  }
}

export async function observarAtleta(req: Request, res: Response) {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  const { atletaUsuarioId, atletaId: atletaIdBody } =
    (req.body ?? {}) as { atletaUsuarioId?: string; atletaId?: string };

  try {
    const owner = await resolveOwnerFromUsuario(userId);
    if (!owner) {
      return res
        .status(403)
        .json({ error: "Apenas Professor, Escolinha ou Clube podem observar atletas." });
    }

    let atletaId = atletaIdBody || "";
    if (!atletaId && atletaUsuarioId) {
      const at = await prisma.atleta.findUnique({
        where: { usuarioId: atletaUsuarioId },
        select: { id: true },
      });
      if (!at) return res.status(404).json({ error: "Atleta não encontrado." });
      atletaId = at.id;
    }
    if (!atletaId) {
      return res.status(400).json({ error: "Informe atletaId ou atletaUsuarioId." });
    }

    const existente = await prisma.atletaObservado.findFirst({
      where: pick({ atletaId, ...owner }),
    });
    if (existente) return res.status(409).json({ error: "Já está observando este atleta." });

    await prisma.atletaObservado.create({
      data: pick({
        atletaId,
        professorId: (owner as any).professorId,
        escolinhaId: (owner as any).escolinhaId,
        clubeId: (owner as any).clubeId,
      }),
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("observarAtleta error:", error);
    return res.status(500).json({ error: "Erro ao observar atleta." });
  }
}

export async function pararDeObservar(req: Request, res: Response) {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado." });

  const { atletaId } = req.params as { atletaId: string };
  if (!atletaId) {
    return res.status(400).json({ error: "atletaId é obrigatório na URL." });
  }

  try {
    const owner = await resolveOwnerFromUsuario(userId);
    if (!owner) {
      return res
        .status(403)
        .json({ error: "Apenas Professor, Escolinha ou Clube podem parar de observar atletas." });
    }

    const del = await prisma.atletaObservado.deleteMany({
      where: pick({ atletaId, ...owner }),
    });

    if (del.count === 0) {
      return res.status(404).json({ error: "Observação não encontrada." });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error("pararDeObservar error:", error);
    return res.status(500).json({ error: "Erro ao parar de observar atleta." });
  }
}