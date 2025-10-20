import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ownerFrom(req: Request) {
  const u: any = (req as any).user || {};
  const id = u?.tipoUsuarioId;
  const tipo = String(u?.tipo || "").toLowerCase();

  if (!id) return {};

  if (tipo === "professor") return { professorId: id };
  if (tipo === "clube")     return { clubeId: id };
  if (tipo === "escolinha" || tipo === "escola") return { escolinhaId: id };
  if (tipo === "olheiro")   return { olheiroId: id };
  return {};
}

async function resolveOwner(req: Request) {
  const u: any = (req as any).user || {};
  const usuarioId: string | undefined = u?.id ?? u?.usuarioId;
  const tipo = String(u?.tipo || "").toLowerCase();
  let tipoUsuarioId: string | undefined = u?.tipoUsuarioId || undefined;

  async function byUsuarioId(model: "professor" | "clube" | "escolinha" | "olheiro") {
    if (tipoUsuarioId || !usuarioId) return tipoUsuarioId;
    const row = await (prisma as any)[model].findFirst({  
      where: { usuarioId },
      select: { id: true },
    });
    return row?.id;
  }

  if (tipo === "professor")  { tipoUsuarioId = await byUsuarioId("professor");  return tipoUsuarioId ? { professorId: tipoUsuarioId } : {}; }
  if (tipo === "clube")      { tipoUsuarioId = await byUsuarioId("clube");      return tipoUsuarioId ? { clubeId: tipoUsuarioId } : {}; }
  if (tipo === "escolinha" || tipo === "escola") {
                             tipoUsuarioId = await byUsuarioId("escolinha");    return tipoUsuarioId ? { escolinhaId: tipoUsuarioId } : {};
  }
  if (tipo === "olheiro")    { tipoUsuarioId = await byUsuarioId("olheiro");    return tipoUsuarioId ? { olheiroId: tipoUsuarioId } : {}; }
  return {};
}

export async function statusObservacao(req: Request, res: Response) {
  const { atletaId } = req.params;
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const owner = await resolveOwner(req);
  const existe = await prisma.atletaObservado.findFirst({ where: { atletaId, ...owner } });
  return res.json({ observando: !!existe });
}

export async function listarObservados(req: Request, res: Response) {
  const owner = await resolveOwner(req);

  const rows = await prisma.atletaObservado.findMany({
    where: owner,
    include: { atleta: { include: { usuario: true } } },
    orderBy: { criadoEm: "desc" },
  });

  const incluirPontuacao = String(req.query.incluirPontuacao ?? "").trim() !== "";

  const lista = rows.map((r) => ({
    // id que o front usa no href /perfil/:id  -> preferir o id do USUÁRIO
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

export async function observarAtleta(req: Request, res: Response) {
  const { atletaId } = req.body as { atletaId?: string };
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const owner = await resolveOwner(req);
  const keys = ["professorId", "escolinhaId", "clubeId", "olheiroId"] as const;
  const presentes = keys.filter(k => (owner as any)[k]);
  if (presentes.length !== 1) {
    return res.status(403).json({
      error: "Seu perfil precisa estar vinculado a um(a) professor/escola/clube/olheiro para observar atletas."
    });
  }

  const where = { atletaId, ...owner };
  const jaExiste = await prisma.atletaObservado.findFirst({ where });
  if (jaExiste) {
    // <-- idempotente
    return res.status(200).json({ ok: true, observando: true, id: jaExiste.id });
  }

  const row = await prisma.atletaObservado.create({ data: where });
  return res.status(201).json({ ok: true, observando: true, id: row.id });
}

export async function pararDeObservar(req: Request, res: Response) {
  const { atletaId } = req.params;
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const owner = await resolveOwner(req);
  await prisma.atletaObservado.deleteMany({ where: { atletaId, ...owner } });
  return res.sendStatus(204); // <-- idempotente
}

export async function listarObservadosPorOlheiro(req: Request, res: Response) {
  try {
    let { olheiroId } = req.params as { olheiroId?: string };
    if (!olheiroId || olheiroId === "me") {
      const u: any = (req as any).user || {};
      olheiroId = u?.tipoUsuarioId || null;
    }
    if (!olheiroId) return res.status(400).json({ error: "olheiroId é obrigatório" });

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
    return res.status(500).json({ error: "Falha ao listar observados do olheiro" });
  }
}