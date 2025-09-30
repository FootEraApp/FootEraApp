import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ownerFrom(req: Request) {
  const u: any = (req as any).user || {};
  const id = u?.tipoUsuarioId;
  const tipo = String(u?.tipo || "").toLowerCase();

  if (tipo === "professor")  return { professorId: id };
  if (tipo === "clube")      return { clubeId: id };
  if (tipo === "escolinha")  return { escolinhaId: id };
  if (tipo === "olheiro")    return { olheiroId: id };
  return {}; 
}

export async function statusObservacao(req: Request, res: Response) {
  const { atletaId } = req.params;
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const where = { atletaId, ...ownerFrom(req) };
  const existe = await prisma.atletaObservado.findFirst({ where });
  return res.json({ observando: !!existe });
}

export async function listarObservados(req: Request, res: Response) {
  const whereOwner = ownerFrom(req);
  const lista = await prisma.atletaObservado.findMany({
    where: whereOwner,
    include: { atleta: { include: { usuario: true } } },
    orderBy: { criadoEm: "desc" },
  });
  res.json(lista);
}

export async function observarAtleta(req: Request, res: Response) {
  const { atletaId } = req.body as { atletaId?: string };
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const owner = ownerFrom(req);
  const keys = ["professorId","escolinhaId","clubeId","olheiroId"];
  if (keys.filter(k => (owner as any)[k]).length !== 1) {
    return res.status(403).json({ error: "Seu tipo de usuário não pode observar atletas" });
  }
  const count = keys.filter(k => (owner as any)[k]).length;
  if (count !== 1)
    return res.status(403).json({ error: "Seu tipo de usuário não pode observar atletas" });

  const data = { atletaId, ...owner };

  const jaExiste = await prisma.atletaObservado.findFirst({ where: data });
  if (jaExiste) return res.status(409).json({ ok: true, message: "Já observando" });

  await prisma.atletaObservado.create({ data });
  return res.status(201).json({ ok: true });
}

export async function pararDeObservar(req: Request, res: Response) {
  const { atletaId } = req.params;
  if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

  const where = { atletaId, ...ownerFrom(req) };
  const item = await prisma.atletaObservado.findFirst({ where });
  if (!item) return res.status(404).json({ message: "Não encontrado" });

  await prisma.atletaObservado.deleteMany({ where: { atletaId, ...ownerFrom(req) } });
  res.json({ ok: true });
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