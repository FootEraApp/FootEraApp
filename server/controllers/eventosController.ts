import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function auth(req: any, res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization || "";
    const [scheme, token] = h.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const payload: any = jwt.verify(token, JWT_SECRET);

    let tipo: string | undefined = payload.tipo;
    let tipoUsuarioId: string | undefined = payload.tipoUsuarioId;

    if (!tipoUsuarioId) {
      const club = await prisma.clube.findFirst({
        where: { usuarioId: payload.id },
        select: { id: true },
      });
      if (club) {
        tipo = "clube";
        tipoUsuarioId = club.id;
      }
    }

    req.user = {
      id: payload.id,
      role: payload.role,
      tipo,
      tipoUsuarioId,
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export async function ehDonoDoClubeOuAdmin(req: any, res: Response, next: NextFunction) {
  const { clubeId } = req.params;
  const user = req.user || {};
  const isAdmin = user.role === "admin" || user.tipo === "admin";

  if (isAdmin) return next();

  if (user.tipo === "clube" && String(user.tipoUsuarioId) === String(clubeId)) {
    return next();
  }

  const club = await prisma.clube.findUnique({
    where: { id: String(clubeId) },
    select: { usuarioId: true },
  });

  if (club && String(club.usuarioId) === String(user.id)) {
    return next();
  }

  return res.status(403).json({ error: "Sem permissão" });
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d.toDate() : null;
}

export async function listarDoClube(req: Request, res: Response) {
  const { clubeId } = req.params;
  const { status, tipo } = req.query as { status?: string; tipo?: string };

  const where: any = { clubeId };
  if (status) where.status = status as any;
  if (tipo) where.tipo = tipo as any;

  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { inicio: "asc" },
  });

  res.json(eventos);
}

export async function criar(req: any, res: Response) {
  const { clubeId } = req.params;
  const {
    titulo,
    tipo = "PENEIRA",
    descricao,
    inicio,
    fim,
    local,
    cidade,
    estado,
    pais,
    endereco,
    vagas,
    valorInscricao,
    linkInscricao,
    requisitos,
    status = "ABERTO",
  } = req.body;

  if (!titulo || !inicio) {
    return res.status(400).json({ error: "titulo e inicio são obrigatórios" });
  }

  const inicioDate = parseDate(inicio);
  const fimDate = parseDate(fim);
  if (!inicioDate) return res.status(400).json({ error: "inicio inválido" });

  const reqs = Array.isArray(requisitos)
    ? requisitos
    : (typeof requisitos === "string" && requisitos.trim() !== "")
    ? requisitos.split(",").map((s: string) => s.trim())
    : [];

  const valor =
    valorInscricao != null && valorInscricao !== "" ? Number(valorInscricao) : null;

  const novo = await prisma.evento.create({
    data: {
      clubeId,
      titulo,
      tipo,
      descricao,
      inicio: inicioDate,
      fim: fimDate ?? undefined,
      local,
      cidade,
      estado,
      pais,
      endereco,
      vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
      valorInscricao: valor as any,
      linkInscricao,
      requisitos: reqs,
      status,
    },
  });

  res.status(201).json(novo);
}

export async function obter(req: Request, res: Response) {
  const { id } = req.params;
  const ev = await prisma.evento.findUnique({ where: { id } });
  if (!ev) return res.status(404).json({ error: "Evento não encontrado" });
  res.json(ev);
}

function mapEventoToAgendaItem(ev: any) {
  return {
    id: ev.id,
    tipo: (ev.tipo as any) || "EVENTO",
    titulo: ev.titulo,
    inicio: ev.inicio,
    fim: ev.fim,
    origem: "EVENTO" as const,
  };
}

export async function minhaAgenda(req: any, res: Response) {
  try {
    const { alvoId, from, to } = req.query as {
      alvoId?: string;
      from?: string;
      to?: string;
    };

    const agora = new Date();
    const fromDate = parseDate(from) || agora;
    const toDate = parseDate(to) || null;

    const where: any = {
      inicio: {
        gte: fromDate,
      },
      status: "ABERTO",
    };

    if (toDate) {
      where.inicio.lte = toDate;
    }

    if (alvoId) {
      const clube = await prisma.clube.findUnique({
        where: { id: String(alvoId) },
        select: { id: true },
      });
      if (clube) {
        where.clubeId = clube.id;
      }
    } else if (req.user?.tipo === "clube" && req.user.tipoUsuarioId) {
      where.clubeId = String(req.user.tipoUsuarioId);
    }

    const eventos = await prisma.evento.findMany({
      where,
      orderBy: { inicio: "asc" },
      take: 100,
    });

    const items = eventos.map(mapEventoToAgendaItem);
    return res.json(items);
  } catch (e) {
    console.error("Erro em eventos.minhaAgenda:", e);
    return res.status(500).json({ error: "Erro ao carregar agenda de eventos" });
  }
}

export async function eventosDoAtleta(req: any, res: Response) {
  try {
    const { usuarioId } = req.params;

    const agora = new Date();

    const eventos = await prisma.evento.findMany({
      where: {
        inicio: { gte: agora },
        status: "ABERTO",
      },
      orderBy: { inicio: "asc" },
      take: 100,
    });

    const items = eventos.map(mapEventoToAgendaItem);
    return res.json(items);
  } catch (e) {
    console.error("Erro em eventos.eventosDoAtleta:", e);
    return res.status(500).json({ error: "Erro ao carregar eventos do atleta" });
  }
}
