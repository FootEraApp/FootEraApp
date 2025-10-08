import { PrismaClient, Prisma, Categoria } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

function normalizeUF(uf?: string) {
  return (uf || "").trim().toUpperCase();
}

function buildWhere(estado?: string, categoria?: string): Prisma.PontuacaoAtletaWhereInput {
  const atletaWhere: Prisma.AtletaWhereInput = {};

  if (estado) {
    atletaWhere.usuario = { estado: normalizeUF(estado) };
  }
  if (categoria) {
    atletaWhere.categoria = { has: categoria as unknown as Categoria };
  }

  const where: Prisma.PontuacaoAtletaWhereInput = {};
  if (Object.keys(atletaWhere).length > 0) {
    where.atleta = atletaWhere;
  }
  return where;
}

const orderBy: Prisma.PontuacaoAtletaOrderByWithRelationInput[] = [
  { pontuacaoTotal: "desc" },
  { pontuacaoPerformance: "desc" },
  { pontuacaoDisciplina: "desc" },
  { pontuacaoResponsabilidade: "desc" },
  { ultimaAtualizacao: "asc" },
];

export async function rankingGlobal(req: Request, res: Response) {
  try {
    const estado = typeof req.query.estado === "string" ? req.query.estado : "";
    const categoria = typeof req.query.categoria === "string" ? req.query.categoria : "";

    const where = buildWhere(estado || undefined, categoria || undefined);

    const viewerUsuarioId = (req as any).userId as string | undefined;
    let viewerAtletaId: string | null = null;

    if (viewerUsuarioId) {
      const v = await prisma.atleta.findUnique({
        where: { usuarioId: viewerUsuarioId },
        select: { id: true },
      });
      viewerAtletaId = v?.id ?? null;
    }

    const [total, top] = await Promise.all([
      prisma.pontuacaoAtleta.count({ where }),
      prisma.pontuacaoAtleta.findMany({
        where,
        orderBy,
        take: 100,
        include: {
          atleta: {
            select: {
              id: true,
              categoria: true,
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  foto: true,
                  cidade: true,
                  estado: true,
                  pais: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = top.map((p, idx) => ({
      rank: idx + 1,
      atletaId: p.atletaId,
      nome: p.atleta.usuario?.nome ?? "—",
      foto: p.atleta.usuario?.foto ?? null,
      cidade: p.atleta.usuario?.cidade ?? null,
      estado: p.atleta.usuario?.estado ?? null,
      pais: p.atleta.usuario?.pais ?? null,
      categoria: p.atleta.categoria ?? [],
      pontuacaoTotal: p.pontuacaoTotal,
      performance: p.pontuacaoPerformance,
      disciplina: p.pontuacaoDisciplina,
      responsabilidade: p.pontuacaoResponsabilidade,
      isViewer: !!viewerAtletaId && p.atletaId === viewerAtletaId,
    }));

    return res.json({ total, items });
  } catch (err) {
    console.error("Erro rankingGlobal:", err);
    return res.status(500).json({ error: "Erro ao carregar ranking global" });
  }
}

export async function rankingPosicao(req: Request, res: Response) {
  try {
    const estado = typeof req.query.estado === "string" ? req.query.estado : "";
    const categoria = typeof req.query.categoria === "string" ? req.query.categoria : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = buildWhere(estado || undefined, categoria || undefined);

    let alvoAtletaId: string | null = null;

    if (q) {
     const candUsers = await prisma.usuario.findMany({
        where: { nome: { contains: q, mode: "insensitive" } },
        select: { id: true },
        take: 10,
      });

      if (candUsers.length > 0) {
        const candUserIds = candUsers.map((u) => u.id);
        const atl = await prisma.atleta.findFirst({
          where: {
            usuarioId: { in: candUserIds },
            ...(where.atleta ?? {}),
          },
          select: { id: true },
        });
        if (atl) alvoAtletaId = atl.id;
      }
    }

    if (!alvoAtletaId) {
      const viewerUsuarioId = (req as any).userId as string | undefined;
      if (viewerUsuarioId) {
        const v = await prisma.atleta.findFirst({
          where: { usuarioId: viewerUsuarioId, ...(where.atleta ?? {}) },
          select: { id: true },
        });
        if (v) alvoAtletaId = v.id;
      }
    }

    if (!alvoAtletaId) {
      return res.status(404).json({ error: "Atleta não encontrado para esta busca/filtro." });
    }

    const all = await prisma.pontuacaoAtleta.findMany({
      where,
      orderBy,
      include: {
        atleta: {
          select: {
            id: true,
            categoria: true,
            usuario: {
              select: { nome: true, foto: true, cidade: true, estado: true, pais: true },
            },
          },
        },
      },
    });

    const idx = all.findIndex((p) => p.atletaId === alvoAtletaId);
    if (idx === -1) {
      return res.status(404).json({ error: "Atleta sem pontuação para os filtros selecionados." });
    }

    const p = all[idx];

    let isViewer = false;
    const viewerUsuarioId = (req as any).userId as string | undefined;
    if (viewerUsuarioId) {
      const viewer = await prisma.atleta.findUnique({
        where: { usuarioId: viewerUsuarioId },
        select: { id: true },
      });
      isViewer = !!viewer?.id && viewer.id === p.atleta.id;
    }

    return res.json({
      atletaId: p.atletaId,
      nome: p.atleta.usuario?.nome ?? "—",
      foto: p.atleta.usuario?.foto ?? null,
      cidade: p.atleta.usuario?.cidade ?? null,
      estado: p.atleta.usuario?.estado ?? null,
      pais: p.atleta.usuario?.pais ?? null,
      categoria: p.atleta.categoria ?? [],
      pontuacaoTotal: p.pontuacaoTotal,
      posicao: idx + 1,
      total: all.length,
      inTop100: idx < 100,
      isViewer,
    });
  } catch (err) {
    console.error("Erro rankingPosicao:", err);
    return res.status(500).json({ error: "Erro ao calcular posição" });
  }
}
