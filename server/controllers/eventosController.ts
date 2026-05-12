import { Request, Response, NextFunction } from "express";
import { EventoStatus } from "@prisma/client";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import { getIO } from "../socket.js";
import { prisma } from "../prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const EVENTO_TIPO_LABEL: Record<string, string> = {
  PENEIRA: "Peneira",
  EVENTO: "Evento",
  TORNEIO: "Torneio",
  COPA: "Copa",
  LIGA: "Liga",
  AMISTOSO: "Amistoso",
  TREINO_ABERTO: "Treino aberto",
  CAMP: "Camp",
  CLINICA: "Clínica",
  SHOWCASE: "Showcase",
  WORKSHOP: "Workshop",
  PALESTRA: "Palestra",
  AULA_AO_VIVO: "Aula ao vivo",
  WEBINAR: "Webinar",
  LIVE: "Live",
};

function mapEventoTipoLabel(tipo?: string | null): string {
  if (!tipo) return "Evento";
  const upper = String(tipo).toUpperCase();
  return EVENTO_TIPO_LABEL[upper] ?? "Evento";
}

function syncEventos(opts: { clubeId?: string | null; escolinhaId?: string | null }) {
  const io = getIO?.();
  if (!io) return;
  io.to("public:eventos").emit("eventos:sync", { scope: "public" });

  if (opts.clubeId) io.to(`clube:${opts.clubeId}`).emit("eventos:sync", { scope: "clube", id: opts.clubeId });
  if (opts.escolinhaId) io.to(`escolinha:${opts.escolinhaId}`).emit("eventos:sync", { scope: "escolinha", id: opts.escolinhaId });
}

export async function auth(req: any, res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization || "";
    const [scheme, token] = h.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const payload: any = jwt.verify(token, JWT_SECRET);

    const userId = String(payload.id);
    let tipo: string | undefined = (payload.tipo || payload.tipoUsuario || "").toLowerCase();
    let tipoUsuarioId: string | undefined = payload.tipoUsuarioId;

    if (!tipoUsuarioId) {
      const club = await prisma.clube.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });
      if (club) {
        tipo = "clube";
        tipoUsuarioId = club.id;
      }
    }

    if (!tipoUsuarioId) {
      const escola = await prisma.escolinha.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });
      if (escola) {
        tipo = "escolinha";
        tipoUsuarioId = escola.id;
      }
    }

    if (!tipoUsuarioId) {
      const professor = await prisma.professor.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });

      if (professor) {
        tipo = "professor";
        tipoUsuarioId = professor.id;
      }
    }

    if (!tipoUsuarioId) {
      const olheiro = await prisma.olheiro.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });

      if (olheiro) {
        tipo = "olheiro";
        tipoUsuarioId = olheiro.id;
      }
    }

    if (!tipoUsuarioId) {
      const federacao = await prisma.federacao.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });

      if (federacao) {
        tipo = "federacao";
        tipoUsuarioId = federacao.id;
      }
    }

    if (!tipoUsuarioId) {
      const marca = await prisma.marca.findFirst({
        where: { usuarioId: userId },
        select: { id: true },
      });

      if (marca) {
        tipo = "marca";
        tipoUsuarioId = marca.id;
      }
    }

    req.user = {
      id: payload.id,
      role: payload.role,
      tipo,
      tipoUsuarioId,
      isAdmin:
        String(payload.role || "").toLowerCase() === "admin" ||
        payload.isAdmin === true,
    };
    next();
  } catch (e) {
    console.error("Erro no auth eventos:", e);
    return res.status(401).json({ error: "Token inválido" });
  }
}

export async function ehDonoDoClubeOuAdmin(
  req: any,
  res: Response,
  next: NextFunction
) {
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

export async function ehDonoDaEscolinhaOuAdmin(
  req: any,
  res: Response,
  next: NextFunction
) {
  const user = req.user || {};
  const tipo = String(user.tipo || user.role || "").toLowerCase();
  const tipoUsuarioId = String(user.tipoUsuarioId || "");

  const isAdmin =
    tipo === "admin" ||
    user.isAdmin === true ||
    String(user.role || "").toLowerCase() === "admin";

  if (isAdmin) return next();

  const paramId = String(
    (req.params.escolinhaId || req.params.escolaId || "").trim()
  );

  if (!paramId || !tipoUsuarioId || paramId !== tipoUsuarioId) {
    return res.status(403).json({
      error: "Você não tem permissão para gerenciar eventos desta escolinha.",
    });
  }

  return next();
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d.toDate() : null;
}

export async function listarPublicos(req: Request & { user?: any }, res: Response) {
  try {
    const creatorUsuarioId = String(req.query.creatorUsuarioId || "").trim();

    const where: any = {
      status: "ABERTO",
    };

    if (creatorUsuarioId) {
      where.creatorUsuarioId = creatorUsuarioId;
    }

    const eventos = await prisma.evento.findMany({
      where,
      include: {
        clube: true,
        escolinha: true,
        inscricoes: true,
      },
      orderBy: { dataEvento: "asc" },
    });

    const userId = req.user?.id;

    const mapped = eventos.map((ev) => ({
      ...ev,
      tipoLabel: mapEventoTipoLabel(ev.tipo),
      totalInscritos: ev.inscricoes?.length ?? 0,
      inscrito: userId ? ev.inscricoes.some((i) => i.usuarioId === userId) : false,
    }));

    return res.json(mapped);
  } catch (e) {
    console.error("Erro listando eventos públicos", e);
    return res.status(500).json({ message: "Erro interno" });
  }
}

export async function listarDoClube(req: Request, res: Response) {
  const { clubeId } = req.params;
  const { status, tipo } = req.query as { status?: string; tipo?: string };

  const where: any = { clubeId };
  if (status) where.status = status as any;
  if (tipo) where.tipo = tipo as any;

  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { dataEvento: "asc" }, 
  });

  const items = eventos.map((ev) => ({
    ...ev,
    tipoLabel: mapEventoTipoLabel(ev.tipo),
  }));

  res.json(items);
}

export async function listarDaEscolinha(req: Request, res: Response) {
  try {
    const escolinhaId = String(
      (req.params as any).escolinhaId || (req.params as any).escolaId || ""
    ).trim();

    if (!escolinhaId) {
      return res.status(400).json({ error: "escolinhaId é obrigatório" });
    }

    const eventos = await prisma.evento.findMany({
      where: { escolinhaId },
      orderBy: { dataEvento: "asc" }, 
    });

    return res.json(eventos);
  } catch (e) {
    console.error("Erro listarDaEscolinha:", e);
    return res
      .status(500)
      .json({ error: "Erro ao listar eventos da escolinha" });
  }
}

export async function criar(req: any, res: Response) {
  try {
    const { clubeId, escolaId, escolinhaId } = req.params as any;

    const ownerClubeId = clubeId || null;
    const ownerEscolinhaId = escolinhaId || escolaId || null;

    if (!ownerClubeId && !ownerEscolinhaId) {
      return res
        .status(400)
        .json({ error: "clubeId ou escolinhaId é obrigatório na rota" });
    }

    const {
      titulo,
      tipo,
      status,
      dataEvento,
      inscricaoInicio,
      inscricaoFim,
      descricao,
      cidade,
      estado,
      pais,
      endereco,
      local,
      vagas,
      valorInscricao,
      linkInscricao,
      requisitos,
    } = req.body;

    const dataEventoDia = parseDate(dataEvento);
    if (!dataEventoDia) {
      return res.status(400).json({ error: "Data de evento é obrigatória" });
    }

    const inscricaoInicioDate = parseDate(inscricaoInicio);
    const inscricaoFimDate = parseDate(inscricaoFim);
    const now = new Date();

    function isPast(d: Date) {
      return d.getTime() < now.getTime();
    }

    function isYearTooHigh(d: Date) {
      return d.getFullYear() > 2050;
    }

    if (isPast(dataEventoDia)) {
      return res.status(400).json({ error: "A data do evento não pode ser no passado." });
    }
    if (isYearTooHigh(dataEventoDia)) {
      return res.status(400).json({ error: "Ano inválido. O ano máximo permitido é 2050." });
    }

    if (inscricaoInicioDate) {
      if (isPast(inscricaoInicioDate)) {
        return res.status(400).json({ error: "Início das inscrições não pode ser no passado." });
      }
      if (isYearTooHigh(inscricaoInicioDate)) {
        return res.status(400).json({ error: "Ano inválido no início das inscrições (máx. 2050)." });
      }
    }

    if (inscricaoFimDate) {
      if (isPast(inscricaoFimDate)) {
        return res.status(400).json({ error: "Fim das inscrições não pode ser no passado." });
      }
      if (isYearTooHigh(inscricaoFimDate)) {
        return res.status(400).json({ error: "Ano inválido no fim das inscrições (máx. 2050)." });
      }
    }

    if (inscricaoInicioDate && inscricaoFimDate && inscricaoFimDate.getTime() < inscricaoInicioDate.getTime()) {
      return res.status(400).json({ error: "Fim das inscrições não pode ser antes do início." });
    }

    let requisitosArr: string[] = [];
    if (Array.isArray(requisitos)) {
      requisitosArr = requisitos.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof requisitos === "string" && requisitos.trim()) {
      requisitosArr = requisitos.split(",").map((r: string) => r.trim()).filter(Boolean);
    }

    const evento = await prisma.evento.create({
      data: {
        ...(ownerClubeId ? { clubeId: ownerClubeId } : {}),
        ...(ownerEscolinhaId ? { escolinhaId: ownerEscolinhaId } : {}),
        titulo: String(titulo),
        tipo: (tipo as any) || "EVENTO",
        status: (status as any) || "ABERTO",
        dataEvento: dataEventoDia,
        inscricaoInicio: inscricaoInicioDate || null,
        inscricaoFim: inscricaoFimDate || null,
        descricao: descricao || null,
        cidade: cidade || null,
        estado: estado || null,
        pais: pais || null,
        endereco: endereco || local || null,
        local: local || null,
        vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
        valorInscricao:
          valorInscricao != null && valorInscricao !== ""
            ? String(valorInscricao)
            : null,
        linkInscricao: linkInscricao || null,
        requisitos: requisitosArr,
      },
    });

    syncEventos({ clubeId: ownerClubeId, escolinhaId: ownerEscolinhaId });

    return res.status(201).json(evento);
  } catch (e) {
    console.error("Erro ao criar evento:", e);
    return res.status(500).json({ error: "Erro ao criar evento" });
  }
}

export async function obter(req: Request, res: Response) {
  const { id } = req.params;
  const ev = await prisma.evento.findUnique({ where: { id } });
  if (!ev) return res.status(404).json({ error: "Evento não encontrado" });

  res.json({
    ...ev,
    tipoLabel: mapEventoTipoLabel(ev.tipo),
  });
}

function mapEventoToAgendaItem(ev: any) {
  return {
    id: ev.id,
    tipo: (ev.tipo as any) || "EVENTO",
    tipoLabel: mapEventoTipoLabel(ev.tipo),
    titulo: ev.titulo,
    inicio: ev.dataEvento,
    fim: null,
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
      dataEvento: {
        gte: fromDate,
      },
      status: EventoStatus.ABERTO,
    };

    if (toDate) {
      where.dataEvento.lte = toDate;
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

    const tipo = String(req.user?.tipo || "").toLowerCase();
    const usuarioId = String(req.user?.id || "").trim();

    if (tipo === "atleta" && usuarioId) {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId },
        select: { id: true },
      });

      if (!atleta?.id) return res.json([]);

      const convWhere: any = {
        atletaId: atleta.id,
        evento: {
          status: "ABERTO",
          dataEvento: { gte: fromDate },
        },
      };

      if (toDate) convWhere.evento.dataEvento.lte = toDate;

      if (alvoId) {
        const clube = await prisma.clube.findUnique({
          where: { id: String(alvoId) },
          select: { id: true },
        });
        if (clube) convWhere.evento.clubeId = clube.id;
      }

      const convocacoes = await prisma.eventoConvocado.findMany({
        where: convWhere,
        include: {
          evento: { select: { id: true, tipo: true, titulo: true, dataEvento: true } },
        },
        orderBy: { evento: { dataEvento: "asc" } },
        take: 200,
      });

      const items = convocacoes.map((c) => ({
        id: c.evento.id,
        tipo: c.evento.tipo ?? "EVENTO",
        tipoLabel: mapEventoTipoLabel(c.evento.tipo),
        titulo: c.evento.titulo,
        inicio: c.evento.dataEvento,
        fim: null,
        origem: "CONVOCACAO" as const,
      }));

      return res.json(items);
    }

    const eventos = await prisma.evento.findMany({
      where,
      orderBy: { dataEvento: "asc" },
      take: 100,
    });

    const items = eventos.map(mapEventoToAgendaItem);
    return res.json(items);

  } catch (e) {
    console.error("Erro em eventos.minhaAgenda:", e);
    return res
      .status(500)
      .json({ error: "Erro ao carregar agenda de eventos" });
  }
}

export async function eventosDoAtleta(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    if (!usuarioId) return res.json([]);

    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta?.id) return res.json([]);

    const agora = new Date();

    const convocacoes = await prisma.eventoConvocado.findMany({
      where: {
        atletaId: atleta.id,
        evento: { status: "ABERTO", dataEvento: { gte: agora } },
      },
      include: {
        evento: { select: { id: true, tipo: true, titulo: true, dataEvento: true } },
      },
      orderBy: { evento: { dataEvento: "asc" } },
      take: 200,
    });

    const items = convocacoes.map((c) => ({
      id: c.evento.id,
      tipo: c.evento.tipo ?? "EVENTO",
      titulo: c.evento.titulo,
      inicio: c.evento.dataEvento,
      fim: null,
    }));

    return res.json(items);
  } catch (e) {
    console.error("Erro em eventos.eventosDoAtleta:", e);
    return res.status(500).json({ error: "Erro ao carregar eventos do atleta" });
  }
}

function normalizarTipo(tipo?: string | null) {
  return String(tipo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function podeCriarEvento(tipo?: string | null) {
  const t = normalizarTipo(tipo);
  return [
    "professor",
    "olheiro",
    "clube",
    "escolinha",
    "federacao",
    "marca",
  ].includes(t);
}

export async function listarMeusEventosCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const eventos = await prisma.evento.findMany({
      where: {
        creatorUsuarioId: usuarioId,
      },
      orderBy: { dataEvento: "asc" },
    });

    return res.json(
      eventos.map((ev) => ({
        ...ev,
        tipoLabel: mapEventoTipoLabel(ev.tipo),
      }))
    );
  } catch (e) {
    console.error("Erro listarMeusEventosCreator:", e);
    return res.status(500).json({ error: "Erro ao listar eventos do creator." });
  }
}

export async function criarEventoCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    const tipoUsuario = normalizarTipo(req.user?.tipo);

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    if (!podeCriarEvento(tipoUsuario)) {
      return res.status(403).json({
        error: "Este tipo de usuário não pode criar eventos.",
      });
    }

    const {
      titulo,
      tipo,
      status,
      dataEvento,
      inscricaoInicio,
      inscricaoFim,
      descricao,
      cidade,
      estado,
      pais,
      endereco,
      local,
      vagas,
      valorInscricao,
      linkInscricao,
      requisitos,
    } = req.body;

    const dataEventoDia = parseDate(dataEvento);

    if (!dataEventoDia) {
      return res.status(400).json({ error: "Data do evento é obrigatória." });
    }

    const inscricaoInicioDate = parseDate(inscricaoInicio);
    const inscricaoFimDate = parseDate(inscricaoFim);

    let requisitosArr: string[] = [];

    if (Array.isArray(requisitos)) {
      requisitosArr = requisitos.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof requisitos === "string" && requisitos.trim()) {
      requisitosArr = requisitos
        .split(",")
        .map((r: string) => r.trim())
        .filter(Boolean);
    }

    const data: any = {
      creatorUsuarioId: usuarioId,
      creatorTipo: tipoUsuario,

      titulo: String(titulo || "").trim(),
      tipo: (tipo as any) || "EVENTO",
      status: (status as any) || "ABERTO",
      dataEvento: dataEventoDia,
      inscricaoInicio: inscricaoInicioDate || null,
      inscricaoFim: inscricaoFimDate || null,
      descricao: descricao || null,
      cidade: cidade || null,
      estado: estado || null,
      pais: pais || null,
      endereco: endereco || local || null,
      local: local || null,
      vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
      valorInscricao:
        valorInscricao != null && valorInscricao !== ""
          ? String(valorInscricao)
          : null,
      linkInscricao: linkInscricao || null,
      requisitos: requisitosArr,
    };

    if (tipoUsuario === "clube" && req.user?.tipoUsuarioId) {
      data.clubeId = String(req.user.tipoUsuarioId);
    }

    if (tipoUsuario === "escolinha" && req.user?.tipoUsuarioId) {
      data.escolinhaId = String(req.user.tipoUsuarioId);
    }

    if (tipoUsuario === "federacao" && req.user?.tipoUsuarioId) {
      data.federacaoId = String(req.user.tipoUsuarioId);
    }

    if (tipoUsuario === "marca" && req.user?.tipoUsuarioId) {
      data.marcaId = String(req.user.tipoUsuarioId);
    }

    const evento = await prisma.evento.create({ data });

    syncEventos({
      clubeId: data.clubeId || null,
      escolinhaId: data.escolinhaId || null,
    });

    return res.status(201).json({
      ...evento,
      tipoLabel: mapEventoTipoLabel(evento.tipo),
    });
  } catch (e) {
    console.error("Erro criarEventoCreator:", e);
    return res.status(500).json({ error: "Erro ao criar evento do creator." });
  }
}