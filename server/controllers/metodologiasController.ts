import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { MetodologiaAssinaturaStatus } from "@prisma/client";

/** Pega userId do token (igual seu padrão) */
function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

/** =========================
 * GET /api/metodologias
 * ?criadorUsuarioId=...
 * ========================= */
export async function listMetodologias(req: Request, res: Response) {
  try {
    const criadorUsuarioId = (req.query.criadorUsuarioId as string) || undefined;

    const items = await prisma.metodologia.findMany({
      where: criadorUsuarioId ? { criadorUsuarioId } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/:id
 * ========================= */
export async function getMetodologiaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        itens: { orderBy: [{ semana: "asc" }, { ordem: "asc" }] },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });
    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar metodologia.", detail: e?.message });
  }
}

/** =========================
 * POST /api/metodologias
 * body: { titulo, descricao?, capaUrl?, totalSemanas?, nivel?, categorias? }
 * ========================= */
export async function createMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { titulo, descricao, capaUrl, totalSemanas, nivel, categorias } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Campo 'titulo' é obrigatório." });
    }

    const created = await prisma.metodologia.create({
      data: {
        titulo: titulo.trim(),
        descricao: typeof descricao === "string" ? descricao.trim() : null,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : null,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : null,

        // opcionais do schema
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,

        criadorUsuarioId: userId,
      },
      include: {
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao criar metodologia.", detail: e?.message });
  }
}

/** =========================
 * PUT /api/metodologias/:id
 * Edita (somente criador)
 * ========================= */
export async function updateMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const { titulo, descricao, capaUrl, totalSemanas, ativo, nivel, categorias } = req.body || {};

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para editar esta metodologia." });
    }

    const updated = await prisma.metodologia.update({
      where: { id },
      data: {
        titulo: typeof titulo === "string" ? titulo.trim() : undefined,
        descricao: typeof descricao === "string" ? descricao.trim() : undefined,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : undefined,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : undefined,
        ativo: typeof ativo === "boolean" ? ativo : undefined,

        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
      },
      include: {
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao editar metodologia.", detail: e?.message });
  }
}

/** =========================
 * DELETE /api/metodologias/:id
 * Exclui (somente criador)
 * ========================= */
export async function deleteMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para excluir esta metodologia." });
    }

    await prisma.metodologia.delete({ where: { id } });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao excluir metodologia.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/minhas/assinadas
 * Lista metodologias assinadas pelo usuário
 * ========================= */
export async function listMinhasMetodologiasAssinadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const assinaturas = await prisma.metodologiaAssinante.findMany({
      where: {
        usuarioId: userId,
        status: MetodologiaAssinaturaStatus.ATIVA, // ✅ no seu schema é status (enum), não "ativo"
      },
      orderBy: { iniciouEm: "desc" }, // ✅ no seu schema é iniciouEm (não criadoEm)
      include: {
        metodologia: {
          include: {
            criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
            _count: { select: { assinantes: true, itens: true } },
          },
        },
      },
    });

    return res.json({
      items: assinaturas.map((a) => ({
        ...a,
        metodologia: a.metodologia, // ✅ agora existe
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar assinadas.", detail: e?.message });
  }
}
