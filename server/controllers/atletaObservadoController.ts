// server/controllers/atletaObservadoController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Para filtros (where): usa os campos ID (professorId, clubeId, ...)
 */
function buildOwnerWhere(tipoRaw: string | undefined, ownerId: string) {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (tipo === "professor") return { professorId: ownerId };
  if (tipo === "clube") return { clubeId: ownerId };
  if (tipo === "escola" || tipo === "escolinha") return { escolinhaId: ownerId };
  if (tipo === "olheiro") return { olheiroId: ownerId };

  // padrão: professorId
  return { professorId: ownerId };
}

/**
 * Para CREATE: usa nested connect (professor: { connect: { id } })
 */
function buildOwnerCreate(tipoRaw: string | undefined, ownerId: string) {
  const tipo = String(tipoRaw || "").toLowerCase();

  if (tipo === "professor") return { professor: { connect: { id: ownerId } } };
  if (tipo === "clube") return { clube: { connect: { id: ownerId } } };
  if (tipo === "escola" || tipo === "escolinha")
    return { escolinha: { connect: { id: ownerId } } };
  if (tipo === "olheiro") return { olheiro: { connect: { id: ownerId } } };

  // padrão: professor
  return { professor: { connect: { id: ownerId } } };
}

/**
 * GET /api/observados/status/:atletaId?ownerId=...&tipo=...
 */
export async function statusObservacao(req: Request, res: Response) {
  const { atletaId } = req.params;
  const { ownerId, tipo } = req.query as { ownerId?: string; tipo?: string };

  if (!atletaId) {
    return res.status(400).json({ message: "atletaId é obrigatório" });
  }
  if (!ownerId) {
    // sem travar: só responde false
    return res.json({ observando: false });
  }

  const ownerWhere = buildOwnerWhere(tipo, ownerId);

  const existe = await prisma.atletaObservado.findFirst({
    where: { atletaId, ...ownerWhere },
  });

  return res.json({ observando: !!existe });
}

/**
 * GET /api/observados?ownerId=...&tipo=...
 */
export async function listarObservados(req: Request, res: Response) {
  const { ownerId, tipo } = req.query as { ownerId?: string; tipo?: string };

  if (!ownerId) {
    return res.status(400).json({ message: "ownerId é obrigatório" });
  }

  const ownerWhere = buildOwnerWhere(tipo, ownerId);

  const rows = await prisma.atletaObservado.findMany({
    where: ownerWhere,
    include: { atleta: { include: { usuario: true } } },
    orderBy: { criadoEm: "desc" },
  });

  const incluirPontuacao = String(req.query.incluirPontuacao ?? "").trim() !== "";

  const lista = rows.map((r) => ({
    id: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? r.atletaId,
    usuarioId: r.atleta?.usuario?.id ?? r.atleta?.usuarioId ?? "",
    atletaId: r.atletaId,
    nome: r.atleta?.usuario?.nome ?? "Atleta",
    foto: r.atleta?.usuario?.foto ?? null,
    posicao: (r as any).atleta?.posicao ?? null,
    idade: (r as any).atleta?.idade ?? null,
    altura: (r as any).atleta?.altura ?? null,
    peso: (r as any).atleta?.peso ?? null,
    observadoEm: r.criadoEm?.toISOString?.() ?? null,
    categoria: (r as any).atleta?.categoria ?? null,
    pontuacao: incluirPontuacao ? (r as any).atleta?.pontuacao ?? null : null,
  }));

  return res.json(lista);
}

/**
 * POST /api/observados
 * body: { atletaId, ownerId, tipo }
 */
export async function observarAtleta(req: Request, res: Response) {
  const { atletaId, ownerId, tipo } = req.body as {
    atletaId?: string;
    ownerId?: string;
    tipo?: string;
  };

  if (!atletaId || !ownerId) {
    return res
      .status(400)
      .json({ message: "atletaId e ownerId são obrigatórios" });
  }

  const ownerWhere = buildOwnerWhere(tipo, ownerId);
  const ownerCreate = buildOwnerCreate(tipo, ownerId);

  try {
    const row = await prisma.atletaObservado.create({
      data: {
        atleta: { connect: { id: atletaId } },
        ...ownerCreate,
      },
    });

    return res.status(201).json({ ok: true, observando: true, id: row.id });
  } catch (e: any) {
    // unique constraint (já existe relação)
    if (e?.code === "P2002") {
      const ja = await prisma.atletaObservado.findFirst({
        where: { atletaId, ...ownerWhere },
      });
      return res.status(200).json({
        ok: true,
        observando: true,
        id: ja?.id ?? null,
      });
    }
    console.error("observarAtleta error", e);
    return res.status(500).json({ error: "Falha ao observar atleta" });
  }
}

/**
 * DELETE /api/observados/:atletaId
 * body: { ownerId, tipo }
 */
export async function pararDeObservar(req: Request, res: Response) {
  const { atletaId } = req.params;
  const { ownerId, tipo } = req.body as { ownerId?: string; tipo?: string };

  if (!atletaId || !ownerId) {
    return res
      .status(400)
      .json({ message: "atletaId e ownerId são obrigatórios" });
  }

  const ownerWhere = buildOwnerWhere(tipo, ownerId);

  await prisma.atletaObservado.deleteMany({
    where: { atletaId, ...ownerWhere },
  });

  return res.sendStatus(204);
}

/**
 * GET /api/observados/olheiro/:olheiroId
 */
export async function listarObservadosPorOlheiro(req: Request, res: Response) {
  try {
    let { olheiroId } = req.params as { olheiroId?: string };
    if (!olheiroId || olheiroId === "me") {
      const q: any = req.query || {};
      olheiroId = q.ownerId || null;
    }
    if (!olheiroId) {
      return res.status(400).json({ error: "olheiroId é obrigatório" });
    }

    const rows = await prisma.atletaObservado.findMany({
      where: { olheiroId },
      include: {
        atleta: {
          include: {
            usuario: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const lista = rows.map((r) => ({
      id: r.atleta?.usuario?.id ?? r.atletaId,
      atletaId: r.atletaId,
      nome: r.atleta?.usuario?.nome ?? "Atleta",
      foto: r.atleta?.usuario?.foto ?? null,
      posicao: (r as any).atleta?.posicao ?? null,
      idade: (r as any).atleta?.idade ?? null,
      altura: (r as any).atleta?.altura ?? null,
      peso: (r as any).atleta?.peso ?? null,
      observadoEm: r.criadoEm?.toISOString?.() ?? null,
      categoria: (r as any).atleta?.categoria ?? null,
      pontuacao: (r as any).atleta?.pontuacao ?? null,
    }));

    return res.json(lista);
  } catch (e) {
    console.error("listarObservadosPorOlheiro", e);
    return res
      .status(500)
      .json({ error: "Falha ao listar observados do olheiro" });
  }
}
