import {
  PrismaClient,
  PosicaoCampo,
  Categoria,
  TipoTreino,
  TreinoStatus,
  TipoMidia,
  TreinoAgendadoStatus,
  Nivel,
} from "@prisma/client";
import { getIO } from "../socket.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";
import { sanitizeText, basicModerationFails } from "../utils/moderation.js";
import {
  onExercicioIncluidoNoTreino,
  onTreinoFeitoPorAlunoFromSubmissao,
} from "../services/statsService.js";
import type { Prisma } from "@prisma/client";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { can } from "server/services/entitlements.js";
import { requireUsage, planLimitFor } from "server/lib/usage.js";
import { sendLimitInfo } from "server/lib/limitInfo.js";
import { UPGRADE_HINT_BY_CAP } from "server/lib/upgradeHints.js";
import { audit } from "server/services/audit.js";
import {
  enforceFeatureLimit,
  type FeatureLimitError,
} from "server/utils/featureLimit.js";
import jwt from "jsonwebtoken";
import { startOfMonth, addMonths, startOfDay } from "date-fns";

const prisma = new PrismaClient();
type Request = ExpressRequest;
type Response = ExpressResponse;

const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || "defaultsecret");

type AuthenticatedRequest = ExpressRequest & {
  userId?: string;
  usuarioId?: string;
  user?: any;
  auth?: any;
};

async function recomputeFeitosTreino(treinoProgramadoId: string) {
  const total = await prisma.submissaoTreino.count({
    where: {
      aprovado: true,
      treinoAgendado: { is: { treinoProgramadoId } },
    },
  });

  await prisma.estatisticaTreino.upsert({
    where: { treinoId: treinoProgramadoId },
    create: { treinoId: treinoProgramadoId, feitosAlunos: total, usosProfessores: 0, ultimoUsoEm: new Date() },
    update: { feitosAlunos: total, ultimoUsoEm: new Date() },
  });

  return total;
}

function pickId(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && typeof v.id === "string") return v.id.trim() || null;
  return null;
}

async function recomputeInclusoesExercicio(exercicioId: string) {
  const total = await prisma.treinoProgramadoExercicio.count({
    where: { exercicioId },
  });

  await prisma.estatisticaExercicio.upsert({
    where: { exercicioId },
    create: { exercicioId, inclusoesEmTreinos: total },
    update: { inclusoesEmTreinos: total },
  });

  return total;
}

async function getOwnerContextByUserId(usuarioId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      tipo: true,
      professor: { select: { id: true, clubeId: true, escolinhaId: true } },
      clube: { select: { id: true } },
      escolinha: { select: { id: true } },
    },
  });

  if (!u) return { professorId: null, clubeId: null, escolinhaId: null };

  const professorId = pickId(u.professor?.id);
  const clubeId = pickId(u.clube?.id) || pickId(u.professor?.clubeId);
  const escolinhaId = pickId(u.escolinha?.id) || pickId(u.professor?.escolinhaId);

  return { professorId, clubeId, escolinhaId, tipo: u.tipo };
}

async function listarAtletasVinculadosPorOwner(ctx: {
  professorId?: string | null;
  clubeId?: string | null;
  escolinhaId?: string | null;
}) {
  const whereOr: any[] = [];
  if (ctx.professorId) whereOr.push({ professorId: ctx.professorId });
  if (ctx.clubeId) whereOr.push({ clubeId: ctx.clubeId });
  if (ctx.escolinhaId) whereOr.push({ escolinhaId: ctx.escolinhaId });

  if (!whereOr.length) return [];

  const rels = await prisma.relacaoTreinamento.findMany({
    where: {
      OR: whereOr,
    },
    select: {
      id: true,
      ativo: true,
      professorId: true,
      clubeId: true,
      escolinhaId: true,
      atleta: {
        select: {
          id: true,
          usuarioId: true,
          foto: true,
          nome: true,
          sobrenome: true,
          categoria: true,
          usuario: { select: { id: true, nome: true, email: true, foto: true, tipo: true } },
        },
      },
    },
  });

  return rels
    .filter((r) => r.ativo !== false)
    .map((r) => ({
      relacaoId: r.id,
      professorId: r.professorId ?? null,
      clubeId: r.clubeId ?? null,
      escolinhaId: r.escolinhaId ?? null,
      atleta: r.atleta,
    }))
    .filter((x) => !!x.atleta);
}

function parseDateInput(raw: any): Date {
  let s = String(raw ?? "").trim();
  if (!s) return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    s = s.slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  }

  return new Date(s);
}

function parseDateOnlySafe(raw: any): Date {
  const s = String(raw ?? "").trim();
  if (!s) return new Date(NaN);

  const datePart = /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }

  return new Date(s);
}

function getUserFromReq(req: AuthenticatedRequest) {
  const anyReq = req as any;

  return (
    anyReq.user ||         
    anyReq.usuario ||
    anyReq.auth?.user ||    
    anyReq.auth ||         
    null
  );
}

const FAIR_USE_TURMA_MES = 30;

type CanKey = Parameters<typeof can>[1];

const CAP_CRIAR_TREINO: CanKey = "Treinos:CriarProgramado" as CanKey;
const FEAT = {
  TREINOS_ILIMITADOS:  "treinos.ilimitados"   as CanKey,
  ROTINAS_ILIMITADAS:  "rotinas.ilimitadas"   as CanKey,
  AGENDAMENTO_LOTE:    "agendamento.lote"     as CanKey,
  AGENDAMENTO_PESSOAL: "agendamento.pessoal"  as CanKey,  
} as const;

async function herdarVideoParaTemporario(nome: string): Promise<string | null> {
  const clean = String(nome || "").trim();
  if (!clean) return null;

  const ex = await prisma.exercicio.findFirst({
    where: {
      nome: { equals: clean, mode: "insensitive" },
      NOT: [{ videoDemonstrativoUrl: null }, { videoDemonstrativoUrl: "" }],
    },
    select: { videoDemonstrativoUrl: true },
  });

  return ex?.videoDemonstrativoUrl ? String(ex.videoDemonstrativoUrl) : null;
}

export async function agendarTreinoPessoal(req: AuthenticatedRequest, res: Response) {
  let user: any = getUserFromReq(req);

  if (!user) {
    const authHeader =
      (req.headers.authorization as string | undefined) ||
      (req.headers.Authorization as string | undefined);

    if (authHeader) {
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      try {
        user = jwt.verify(token, JWT_SECRET) as any;
        (req as any).user = user;
        (req as any).userId = user.id;
      } catch {
      }
    }
  }

  if (!user) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  if (!can(user, FEAT.AGENDAMENTO_PESSOAL)) {
    return res.status(402).json({
      code: "UPGRADE_REQUIRED",
      message: "Agendamento pessoal de treinos está disponível apenas para planos Pro.",
    });
  }

  const usuarioId = (req.userId as string | undefined) || (user.id as string | undefined);
  if (!usuarioId) {
    return res.status(400).json({ message: "Não foi possível identificar o usuário." });
  }

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true },
  });

  if (!atleta) {
    return res.status(400).json({ message: "Usuário não é atleta." });
  }

  const atletaId = atleta.id;

  const { titulo, dataTreino, descricao } = req.body as {
    titulo: string;
    dataTreino: string;
    descricao?: string;
  };

  if (!titulo || !dataTreino) {
    return res.status(400).json({ message: "Título e data são obrigatórios." });
  }

  const novaData = parseDateInput(dataTreino);
    if (Number.isNaN(novaData.getTime())) {
      return res.status(400).json({ message: "dataTreino inválida" });
    }

  const dataExpiracao = new Date(novaData.getTime() + 3 * 24 * 60 * 60 * 1000);

  const treino = await prisma.treinoAgendado.create({
    data: {
      titulo,
      atletaId,
      dataTreino: novaData,
      dataExpiracao,
      dataOriginal: novaData,
      status: TreinoAgendadoStatus.AGENDADO,
      local: null,
      treinoProgramadoId: null,
    },
  });

  return res.status(201).json(treino);
}

export async function agendarTreinoLote(req: AuthenticatedRequest, res: Response) {
  const user = getUserFromReq(req);

  if (!user || !can(user, FEAT.AGENDAMENTO_LOTE)) {
    return res.status(402).json({
      code: "UPGRADE_REQUIRED",
      message: "Agendamento em lote está disponível apenas para planos Pro.",
    });
  }

  const { treinoProgramadoId, atletasIds, dataTreino } = req.body as {
    treinoProgramadoId: string;
    atletasIds: string[];
    dataTreino: string;
  };

  if (!treinoProgramadoId || !atletasIds?.length || !dataTreino) {
    return res.status(400).json({ message: "Dados incompletos para agendamento em lote." });
  }

  const dt = /T/.test(String(dataTreino)) ? parseDateInput(dataTreino) : parseDateOnlySafe(dataTreino);
  if (Number.isNaN(dt.getTime())) {
    return res.status(400).json({ message: "dataTreino inválida" });
  }

  const dataExpiracao = new Date(dt.getTime() + 3 * 24 * 60 * 60 * 1000);

  const tp = await prisma.treinoProgramado.findUnique({
    where: { id: treinoProgramadoId },
    select: { nome: true },
  });
  if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

  const resolved = req.userId ? await resolveEntidade(req.userId) : null;
  if (!resolved) {
    return res.status(403).json({ message: "Sem permissão." });
  }
  if (resolved.tipo !== "escolinha" && resolved.tipo !== "clube" && resolved.tipo !== "professor") {
    return res.status(403).json({ message: "Apenas professor/clube/escolinha podem agendar em lote." });
  }

  const tpFull = await prisma.treinoProgramado.findUnique({
    where: { id: treinoProgramadoId },
    select: {
      id: true,
      nome: true,
      escolinhaId: true,
      clubeId: true,
      professorId: true,
      professores: { select: { professorId: true } },
    },
  });
  if (!tpFull) return res.status(404).json({ message: "Treino programado não encontrado." });

  let permitido = false;

  if (resolved.tipo === "professor") {
    permitido =
      tpFull.professorId === resolved.id ||
      tpFull.professores.some((p) => p.professorId === resolved.id);

    if (!permitido && tpFull.escolinhaId) {
      const escolinhaDoProfessor = await getEscolinhaIdDoProfessor(resolved.id);
      if (escolinhaDoProfessor && tpFull.escolinhaId === escolinhaDoProfessor) {
        permitido = true;
      }
    }

    if (!permitido && tpFull.clubeId) {
      const clubeDoProfessor = await getClubeIdDoProfessor(resolved.id);
      if (clubeDoProfessor && tpFull.clubeId === clubeDoProfessor) {
        permitido = true;
      }
    }
  }

  if (resolved.tipo === "clube") {
    permitido = tpFull.clubeId === resolved.id;

    if (!permitido) {
      const profIds = await getProfessorIdsDoClube(resolved.id);
      if (profIds.length) {
        permitido =
          (tpFull.professorId ? profIds.includes(tpFull.professorId) : false) ||
          tpFull.professores.some((p) => profIds.includes(p.professorId));
      }
    }
  }

  if (resolved.tipo === "escolinha") {
    if (tpFull.escolinhaId === resolved.id) permitido = true;

    if (!permitido) {
      const profIds = await getProfessorIdsDaEscolinha(resolved.id);
      if (profIds.length) {
        permitido =
          (tpFull.professorId ? profIds.includes(tpFull.professorId) : false) ||
          tpFull.professores.some((p) => profIds.includes(p.professorId));
      }
    }
  }

  if (!permitido) {
    return res.status(403).json({ message: "Você não pode agendar este treino (não pertence à sua organização)." });
  }

  if (resolved.tipo === "escolinha") {
    const allowed = await prisma.atleta.findMany({
      where: { id: { in: atletasIds }, escolinhaId: resolved.id },
      select: { id: true },
    });
    const okSet = new Set(allowed.map((a) => a.id));
    const invalidos = atletasIds.filter((id) => !okSet.has(id));
    if (invalidos.length) {
      return res.status(403).json({
        message: "Um ou mais atletas não pertencem à sua escolinha.",
        invalidos,
      });
    }
  }

  await prisma.$transaction(
    atletasIds.map((atletaId) =>
      prisma.treinoAgendado.create({
        data: {
          titulo: tp.nome ?? "Treino",
          atletaId,
          treinoProgramadoId,
          dataTreino: dt,
          dataExpiracao,
          dataOriginal: dt,
          status: TreinoAgendadoStatus.AGENDADO,
        },
      })
    )
  );

  await prisma.estatisticaTreino.upsert({
    where: { treinoId: treinoProgramadoId },
    create: {
      treinoId: treinoProgramadoId,
      usosProfessores: atletasIds.length,
      feitosAlunos: 0,
      ultimoUsoEm: new Date(),
    },
    update: {
      usosProfessores: { increment: atletasIds.length },
      ultimoUsoEm: new Date(),
    },
  });
  return res.status(201).json({ ok: true });
}

async function atletaTemVinculo(atletaId: string) {
  const a = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { id: true, clubeId: true, escolinhaId: true },
  });
  if (!a) return false;
  const relCount = await prisma.relacaoTreinamento.count({ where: { atletaId } });
  return !!(a.clubeId || a.escolinhaId || relCount > 0);
}

function normalizeCategorias(input: any): Categoria[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];

  const mapOne = (raw: any): string => {
    const s = String(raw).trim();
    const m = s.match(/^sub[\s-]?(\d{1,2})$/i);
    if (m) return `Sub-${m[1]}`;
    if (/^livre$/i.test(s)) return "Livre";
    return s;
  };

  const mapped = arr.map(mapOne);
  const valid = mapped.filter((c) => (Object.values(Categoria) as string[]).includes(c));
  if (valid.length !== mapped.length) throw new Error("Categoria(s) inválida(s)");
  return valid as Categoria[];
}

function normalizeTipoTreino(input: any): TipoTreino | undefined {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (s === "fisico" || s === "físico") return "Fisico";
  if (s === "tecnico" || s === "técnico") return "Tecnico";
  if (s === "tatico" || s === "tático") return "Tatico";
  if (s === "mental") return "Mental";
  return (Object.values(TipoTreino) as string[]).includes(String(input))
    ? (input as TipoTreino)
    : undefined;
}

export async function getCalendarioTreinos(req: Request, res: Response) {
  try {
    const usuarioId = (req as AuthenticatedRequest).userId;
    const { start, end } = req.query;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Parâmetros 'start' e 'end' são obrigatórios" });
    }

    const startDate = parseDateInput(start);
    const endDate = parseDateInput(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Datas 'start'/'end' inválidas" });
    }

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    if (!atleta) {
      return res
        .status(404)
        .json({ error: "Atleta não encontrado para este usuário" });
    }

    const treinos = await prisma.treinoAgendado.findMany({
      where: {
        atletaId: atleta.id,
        dataTreino: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        treinoProgramado: true,
      },
      orderBy: {
        dataTreino: "asc",
      },
    });

    const eventos = treinos.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      start: t.dataTreino,
      end: t.dataExpiracao ?? t.dataTreino,
      status: t.status,
      treinoProgramadoId: t.treinoProgramadoId,
      nivel: t.treinoProgramado?.nivel ?? null,
      categoria: t.treinoProgramado?.categoria ?? [],
    }));

    return res.json(eventos);
  } catch (err) {
    console.error("Erro ao buscar calendário de treinos:", err);
    return res.status(500).json({ error: "Erro ao buscar calendário" });
  }
}

async function notificarNovoTreino(
  deUsuarioId: string,
  atletaId: string,
  treinoId: string,
  titulo: string
) {
  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });
  if (!atleta) return;

  const saved = await prisma.mensagem.create({
    data: {
      deId: deUsuarioId,
      paraId: atleta.usuarioId,
      tipo: "NORMAL",
      conteudo: `NOVO_TREINO:${treinoId}:${titulo}`,
    },
  });

  const io = getIO();
  if (io) {
    io.to(atleta.usuarioId).emit("novaMensagem", { ...saved, pending: false });
    io.to(`u:${atleta.usuarioId}`).emit("novaMensagem", { ...saved, pending: false });
    io.to(deUsuarioId).emit("novaMensagem", { ...saved, pending: false });
    io.to(`u:${deUsuarioId}`).emit("novaMensagem", { ...saved, pending: false });
  }
}

async function resolveEntidade(
  usuarioOuEntidadeId: string
): Promise<
  | { tipo: "professor"; id: string }
  | { tipo: "clube"; id: string }
  | { tipo: "escolinha"; id: string }
  | null
> {
  const [prof, clube, escola] = await Promise.all([
    prisma.professor.findFirst({
      where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] },
      select: { id: true },
    }),
    prisma.clube.findFirst({
      where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] },
      select: { id: true },
    }),
    prisma.escolinha.findFirst({
      where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] },
      select: { id: true },
    }),
  ]);
  if (prof) return { tipo: "professor", id: prof.id };
  if (clube) return { tipo: "clube", id: clube.id };
  if (escola) return { tipo: "escolinha", id: escola.id };
  return null;
}

async function getProfessoresVinculadosDaEscolinha(escolinhaId: string) {
  const links = await prisma.professorEscolinha.findMany({
    where: { escolinhaId },
    select: { professor: { select: { id: true, nome: true } } },
  });

  const fromM2M = links.map((l) => l.professor);

  const legacy = await prisma.professor.findMany({
    where: { escolinhaId },
    select: { id: true, nome: true },
  });

  const map = new Map<string, { id: string; nome: string }>();
  for (const p of [...fromM2M, ...legacy]) {
    if (p?.id) map.set(p.id, p);
  }
  return [...map.values()];
}

async function getProfessorIdsDaEscolinha(escolinhaId: string) {
  const profs = await getProfessoresVinculadosDaEscolinha(escolinhaId);
  return profs.map((p) => p.id);
}

async function getEscolinhaIdDoProfessor(professorId: string): Promise<string | null> {
  if (!professorId) return null;

  const p = await prisma.professor.findUnique({
    where: { id: professorId },
    select: { escolinhaId: true },
  });
  if (p?.escolinhaId) return p.escolinhaId;

  const link = await prisma.professorEscolinha.findFirst({
    where: { professorId },
    orderBy: { createdAt: "desc" },
    select: { escolinhaId: true },
  });

  return link?.escolinhaId ?? null;
}

async function getProfessoresVinculadosDoClube(clubeId: string) {
  const links = await prisma.professorClube.findMany({
    where: { clubeId },
    select: { professor: { select: { id: true, nome: true } } },
  });

  const fromM2M = links.map((l) => l.professor);

  const legacy = await prisma.professor.findMany({
    where: { clubeId },
    select: { id: true, nome: true },
  });

  const map = new Map<string, { id: string; nome: string }>();
  for (const p of [...fromM2M, ...legacy]) {
    if (p?.id) map.set(p.id, p);
  }
  return [...map.values()];
}

async function getProfessorIdsDoClube(clubeId: string) {
  const profs = await getProfessoresVinculadosDoClube(clubeId);
  return profs.map((p) => p.id);
}

async function getClubeIdDoProfessor(professorId: string): Promise<string | null> {
  if (!professorId) return null;

  const p = await prisma.professor.findUnique({
    where: { id: professorId },
    select: { clubeId: true },
  });
  if (p?.clubeId) return p.clubeId;

  const link = await prisma.professorClube.findFirst({
    where: { professorId },
    orderBy: { createdAt: "desc" },
    select: { clubeId: true },
  });

  return link?.clubeId ?? null;
}

async function buildTreinosWhereByLogin(req: AuthenticatedRequest) {
  if (!req.userId) return null;

  const resolved = await resolveEntidade(req.userId);

  const or: any[] = [];

  if (resolved?.tipo === "professor") {
    const pid = resolved.id;

    or.push({ professorId: pid });
    or.push({ professores: { some: { professorId: pid } } });

    const cid = await getClubeIdDoProfessor(pid);
    if (cid) or.push({ clubeId: cid });

    const eid = await getEscolinhaIdDoProfessor(pid);
    if (eid) or.push({ escolinhaId: eid });

    return { OR: or };
  }

  if (resolved?.tipo === "clube") {
    const cid = resolved.id;

    or.push({ clubeId: cid });

    const profIds = await getProfessorIdsDoClube(cid);
    if (profIds.length) {
      or.push({ professorId: { in: profIds } });
      or.push({ professores: { some: { professorId: { in: profIds } } } });
    }

    return { OR: or };
  }

  if (resolved?.tipo === "escolinha") {
    const eid = resolved.id;

    or.push({ escolinhaId: eid });

    const profIds = await getProfessorIdsDaEscolinha(eid);
    if (profIds.length) {
      or.push({ professorId: { in: profIds } });
      or.push({ professores: { some: { professorId: { in: profIds } } } });
    }

    return { OR: or };
  }

  const u = await prisma.usuario.findUnique({
    where: { id: req.userId },
    select: { tipo: true },
  });

  if (!u) return null;

  const tipoStr = String(u.tipo ?? "").toLowerCase();

  if (tipoStr === "atleta") {
    const ctx = await idsInstituicoesAtuais(prisma, req.userId);

    if (
      (!ctx.clubes || ctx.clubes.length === 0) &&
      (!ctx.escolinhas || ctx.escolinhas.length === 0) &&
      (!ctx.professores || ctx.professores.length === 0)
    ) {
      return { OR: [{ id: "__none__" }] }; 
    }

    if (ctx.clubes.length) or.push({ clubeId: { in: ctx.clubes } });
    if (ctx.escolinhas.length) or.push({ escolinhaId: { in: ctx.escolinhas } });
    if (ctx.professores.length) {
      or.push({ professorId: { in: ctx.professores } });
      or.push({
        professores: { some: { professorId: { in: ctx.professores } } },
      });
    }

    return { OR: or };
  }

  if (tipoStr === "admin") {
    return {}; 
  }

  return null;
}

function pushCriadoresUniq(
  arr: Array<{ tipo: "Professor" | "Clube" | "Escolinha"; id: string; nome: string }>,
  item: { tipo: "Professor" | "Clube" | "Escolinha"; id: string; nome: string } | null | undefined
) {
  if (!item?.id) return;
  const key = `${item.tipo}:${item.id}`;
  if (arr.some((x) => `${x.tipo}:${x.id}` === key)) return;
  arr.push(item);
}

export async function treinosDisponiveis(req: AuthenticatedRequest, res: Response) {
  try {
    const where = await buildTreinosWhereByLogin(req);
    if (!where) return res.status(401).json({ message: "Usuário não autenticado." });

    const treinos = await prisma.treinoProgramado.findMany({
      where,
      include: {
        exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const resposta = treinos.map((t) => {
      const criadores: Array<{ tipo: "Professor" | "Clube" | "Escolinha"; id: string; nome: string }> = [];

      if ((t as any).Professor) {
        criadores.push({
          tipo: "Professor",
          id: (t as any).Professor.id,
          nome: (t as any).Professor.nome,
        });
      }

      if (t.professores?.length) {
        for (const p of t.professores) {
          const exists = criadores.some((c) => c.tipo === "Professor" && c.id === p.professor.id);
          if (!exists) {
            criadores.push({
              tipo: "Professor",
              id: p.professor.id,
              nome: p.professor.nome,
            });
          }
        }
      }

      if (t.clube) criadores.push({ tipo: "Clube", id: t.clube.id, nome: t.clube.nome });
      if (t.escolinha) criadores.push({ tipo: "Escolinha", id: t.escolinha.id, nome: t.escolinha.nome });

      return {
        id: t.id,
        nome: t.nome,
        descricao: t.descricao,
        nivel: t.nivel,
        duracao: t.duracao,
        objetivo: t.objetivo,
        dicas: t.dicas,
        pontuacao: t.pontuacao ?? null,
        criadores,
        exercicios: t.exercicios.map((e) => ({
          id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
          nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
          repeticoes: e.repeticoes ?? "",
        })),
      };
    });

    return res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos disponíveis:", error);
    return res.status(500).json({ message: "Erro ao buscar treinos disponíveis" });
  }
}

export async function salvarTreinoNaBiblioteca(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user as any;
    const usuarioId = req.userId!;

    const tipoStr = String(user?.tipo ?? user?.tipoUsuario ?? "").toLowerCase();

    let atletaId: string | undefined =
      tipoStr === "atleta" ? user.tipoUsuarioId : undefined;

    if (!atletaId) {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId },
        select: { id: true },
      });
      atletaId = atleta?.id;
    }

    if (!atletaId) {
      return res.status(400).json({ message: "atletaId não encontrado para o usuário logado." });
    }

    const { treinoProgramadoId } = req.body as { treinoProgramadoId?: string };

    if (!treinoProgramadoId) {
      return res.status(400).json({ message: "treinoProgramadoId é obrigatório." });
    }

    const plano = user?.plano ?? "FREE";

    const treinoProgramado = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: { nome: true, descricao: true },
    });

    if (!treinoProgramado) {
      return res.status(404).json({ message: "Treino programado não encontrado." });
    }

    await enforceFeatureLimit({
      prisma,
      feature: "TREINO_SALVO",
      atletaId,
      usuarioId,
      plano,
    });

    const existente = await prisma.treinoAgendado.findFirst({
      where: {
        atletaId,
        treinoProgramadoId,
        status: { not: TreinoAgendadoStatus.CONCLUIDO },
        OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }],
      },
      orderBy: { dataTreino: "desc" },
    });

    if (existente) {
      return res.status(409).json({ message: "Esse treino já está na sua biblioteca." });
    }

    const salvo = await prisma.treinoSalvo.create({
      data: {
        usuarioId,
        treinoProgramadoId,
        titulo: treinoProgramado.nome ?? "Treino salvo",
        conteudo: treinoProgramado.descricao ?? "Treino salvo na sua biblioteca.",
      },
    });

    return res.status(201).json(salvo);
  } catch (err: any) {
    if ((err as FeatureLimitError)?.code === "LIMIT_REACHED") {
      const fl = err as FeatureLimitError;
      const capability = fl.capability;
      const window = fl.window;
      const allowed = fl.allowed;
      const remaining = fl.remaining;
      const upgradeHint = UPGRADE_HINT_BY_CAP[capability];

      return sendLimitInfo(res, {
        capability,
        window,
        allowed,
        remaining,
        ...(upgradeHint ? { upgradeHint } : {}),
      });
    }

    console.error("salvarTreinoNaBiblioteca", err);
    return res
      .status(500)
      .json({ message: "Erro ao salvar treino na biblioteca." });
  }
}

export async function listarTodosTreinosProgramados(req: AuthenticatedRequest, res: Response) {
  try {
    const where = await buildTreinosWhereByLogin(req);
    if (!where) return res.status(401).json({ message: "Usuário não autenticado." });

    const rows = await prisma.treinoProgramado.findMany({
      where,
      include: {
        exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const out = rows.map((t) => {
      const criadores: Array<{ tipo: "Professor" | "Clube" | "Escolinha"; id: string; nome: string }> = [];

      if ((t as any).Professor) {
        pushCriadoresUniq(criadores, {
          tipo: "Professor",
          id: (t as any).Professor.id,
          nome: (t as any).Professor.nome,
        });
      }

      for (const p of t.professores ?? []) {
        pushCriadoresUniq(criadores, { tipo: "Professor", id: p.professor.id, nome: p.professor.nome });
      }

      if (t.clube) pushCriadoresUniq(criadores, { tipo: "Clube", id: t.clube.id, nome: t.clube.nome });
      if (t.escolinha) pushCriadoresUniq(criadores, { tipo: "Escolinha", id: t.escolinha.id, nome: t.escolinha.nome });

      return {
        id: t.id,
        nome: t.nome,
        descricao: t.descricao ?? null,
        codigo: t.codigo ?? null,
        nivel: t.nivel ?? null,
        tipoTreino: t.tipoTreino ?? null,
        duracao: t.duracao ?? null,
        pontuacao: t.pontuacao ?? null,
        dataAgendada: t.dataAgendada ? t.dataAgendada.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        categoria: t.categoria ?? [],
        criadores,
        exercicios: t.exercicios.map((x) => ({
          repeticoes: x.repeticoes ?? "",
          exercicio: { nome: x.exercicio?.nome ?? x.exercicioTemporario?.nome ?? "" },
        })),
      };
    });

    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao buscar treinos programados" });
  }
}

export async function obterTreinoProgramadoPorId(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const treino = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        exercicios: {
          select: {
            repeticoes: true,
            exercicio: { select: { id: true, nome: true } },
            exercicioTemporario: { select: { id: true, nome: true } },
          },
        },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
    });
    if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

    const out = {
      ...treino,
      exercicios: treino.exercicios.map((e) => ({
        repeticoes: e.repeticoes,
        exercicio: {
          id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
          nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
        },
      })),
    };
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar treino programado" });
  }
}

export async function agendarTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      titulo,
      dataTreino,
      dataExpiracao,
      atletaId: atletaIdBody,
      tipoUsuarioId,
      treinoProgramadoId: treinoProgramadoIdRaw,
      programadoId,
      turmaId: turmaIdRaw,
      elencoId: elencoIdRaw,
    } = req.body;

    const treinoProgramadoId = String(treinoProgramadoIdRaw ?? programadoId ?? "").trim();
    if (!treinoProgramadoId) {
      return res.status(400).json({ message: "treinoProgramadoId inválido" });
    }

    const atletaRef = String(atletaIdBody ?? tipoUsuarioId ?? "").trim();
    if (!atletaRef || !dataTreino) {
      return res.status(400).json({ message: "Dados incompletos." });
    }

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ id: atletaRef }, { usuarioId: atletaRef }] },
      select: { id: true, usuarioId: true },
    });
    if (!atleta) return res.status(404).json({ message: "Atleta não encontrado." });

    const atletaId = atleta.id;

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: { id: true, nome: true },
    });
    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

    const tituloFinal = titulo && String(titulo).trim() ? String(titulo).trim() : (tp.nome ?? "Treino");

    const quandoBase = /T/.test(String(dataTreino)) ? parseDateInput(dataTreino) : parseDateOnlySafe(dataTreino);
    if (Number.isNaN(quandoBase.getTime())) {
      return res.status(400).json({ message: "dataTreino inválida" });
    }

    const exp = dataExpiracao
      ? parseDateInput(dataExpiracao)
      : new Date(quandoBase.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(exp.getTime())) {
      return res.status(400).json({ message: "dataExpiracao inválida" });
    }

    const turmaId = typeof turmaIdRaw === "string" ? turmaIdRaw.trim() : "";
    const elencoId = typeof elencoIdRaw === "string" ? elencoIdRaw.trim() : "";
    const resolvedMe = req.userId ? await resolveEntidade(req.userId) : null;
    const tipoUser = resolvedMe?.tipo ?? String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    const criadoPorProfessorId = tipoUser === "professor" ? (resolvedMe?.id ?? null) : null;

    if (["professor", "clube", "escolinha"].includes(tipoUser)) {
      const resolved = await resolveEntidade(req.userId!);

      if (resolved) {
        const whereVinc =
          resolved.tipo === "professor"
            ? { professorId: resolved.id }
            : resolved.tipo === "clube"
            ? { clubeId: resolved.id }
            : { escolinhaId: resolved.id };

        const [temVinc, ehObservado] = await Promise.all([
          prisma.relacaoTreinamento.findFirst({
            where: { atletaId, ...whereVinc },
            select: { id: true },
          }),
          prisma.atletaObservado.findFirst({
            where: { atletaId, ...whereVinc },
            select: { id: true },
          }),
        ]);

        if (!temVinc && !ehObservado) {
          if (turmaId) {
            const membro = await prisma.turmaUsuario.findFirst({
              where: { turmaId, usuarioId: atleta.usuarioId ?? "__none__" },
              select: { id: true },
            });

            const turmaOwnerOr: Prisma.TurmaWhereInput[] = [];

            if (resolved.tipo === "professor") {
              turmaOwnerOr.push({
                professores: {
                  some: { professorId: resolved.id },
                },
              });
            }

            if (resolved.tipo === "clube") {
              turmaOwnerOr.push({ clubeId: resolved.id });
            }

            if (resolved.tipo === "escolinha") {
              turmaOwnerOr.push({ escolinhaId: resolved.id });
            }

            const turmaOk = await prisma.turma.findFirst({
              where: {
                id: turmaId,
                ...(turmaOwnerOr.length ? { OR: turmaOwnerOr } : {}),
              },
              select: { id: true },
            });
            if (!membro || !turmaOk) {
              return res.status(403).json({
                message: "Você não tem permissão para agendar para esta turma/atleta.",
              });
            }
          } else if (elencoId) {
            const membro = await prisma.atletaElenco.findFirst({
              where: { elencoId, atletaId },
              select: { id: true },
            });

            const elencoOwnerOr: Prisma.ElencoWhereInput[] = [];

            if (resolved.tipo === "professor") elencoOwnerOr.push({ professorId: resolved.id });
            if (resolved.tipo === "clube") elencoOwnerOr.push({ clubeId: resolved.id });
            if (resolved.tipo === "escolinha") elencoOwnerOr.push({ escolinhaId: resolved.id });

            const elencoOk = await prisma.elenco.findFirst({
              where: {
                id: elencoId,
                ...(elencoOwnerOr.length ? { OR: elencoOwnerOr } : {}),
              },
              select: { id: true },
            });

            if (!membro || !elencoOk) {
              return res.status(403).json({
                message: "Você não tem permissão para agendar para este elenco/atleta.",
              });
            }
          } else {
            return res.status(403).json({ message: "Você não possui vínculo nem observação com este atleta." });
          }
        }
      }
    }

    const now = new Date();

    const existente = await prisma.treinoAgendado.findFirst({
      where: {
        atletaId,
        treinoProgramadoId,
        status: { not: TreinoAgendadoStatus.CONCLUIDO },
        OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }],
      },
      orderBy: { dataTreino: "desc" },
    });

    if (existente) {
      const tu = await prisma.treinoUsuario.findUnique({
        where: { treinoId_usuarioId: { treinoId: existente.id, usuarioId: req.userId! } },
        select: { status: true },
      });

      const ativo =
        (!existente.dataExpiracao || existente.dataExpiracao >= now) &&
        tu?.status !== TreinoStatus.COMPLETED;

      if (ativo) {
        if (existente.dataTreino) {
          const deltaDays = Math.ceil(
            Math.abs(quandoBase.getTime() - existente.dataTreino.getTime()) / 86400000
          );
          if (deltaDays > 7) {
            return res.status(422).json({ message: "Só é permitido remarcar em até 7 dias." });
          }
        }

        const atualizado = await prisma.treinoAgendado.update({
          where: { id: existente.id },
          data: {
            titulo: tituloFinal,
            dataTreino: quandoBase,
            dataExpiracao: exp,
            status: TreinoAgendadoStatus.AGENDADO,
          },
        });

        await audit(req, {
          acao: "ALTERAR_AGENDA",
          entidade: "TreinoAgendado",
          entidadeId: atualizado.id,
          descricao: "Agendamento remarcado",
          meta: { atletaId, dataTreino: atualizado.dataTreino, status: "Agendado" },
        });

        await notificarNovoTreino(req.userId!, atletaId, atualizado.id, tituloFinal);
        return res.status(200).json(atualizado);
      }
    }

    const criado = await prisma.treinoAgendado.create({
      data: {
        titulo: tituloFinal,
        atletaId,
        treinoProgramadoId,
        dataTreino: quandoBase,
        dataExpiracao: exp,
        dataOriginal: quandoBase,
        status: TreinoAgendadoStatus.AGENDADO,
        criadoPorProfessorId: tipoUser === "professor" ? (resolvedMe?.id ?? null) : null,
      },
    });

    if (treinoProgramadoId) {
      await prisma.estatisticaTreino.upsert({
        where: { treinoId: treinoProgramadoId },
        create: { treinoId: treinoProgramadoId, usosProfessores: 1, feitosAlunos: 0, ultimoUsoEm: new Date() },
        update: { usosProfessores: { increment: 1 }, ultimoUsoEm: new Date() },
      });
    }

    await audit(req, {
      acao: "ALTERAR_AGENDA",
      entidade: "TreinoAgendado",
      entidadeId: criado.id,
      descricao: "Agendamento criado",
      meta: { atletaId, dataTreino: criado.dataTreino, status: "Agendado" },
    });

    await notificarNovoTreino(req.userId!, atletaId, criado.id, tituloFinal);
    return res.status(201).json(criado);
  } catch (e) {
    console.error("agendarTreino", e);
    return res.status(500).json({ message: "Erro ao agendar treino." });
  }
}

export const excluirTreinoAgendado = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: { atleta: { select: { usuarioId: true } } },
    });

    if (!ag) return res.status(200).json({ message: "Já não existe." });

    if (ag.atleta?.usuarioId !== req.userId) {
      return res.status(403).json({ error: "Sem permissão para excluir este treino." });
    }

    await prisma.treinoAgendado.delete({ where: { id } });

    await audit(req, {
      acao: "ALTERAR_AGENDA",
      entidade: "TreinoAgendado",
      entidadeId: id,
      descricao: "Agendamento cancelado",
      meta: { atletaId: ag.atletaId, dataTreino: ag.dataTreino, status: "Cancelado" },
    });

    return res.status(200).json({ message: "Treino agendado deletado." });
  } catch (error) {
    console.error("Erro ao deletar treino agendado:", error);
    res.status(500).json({ error: "Erro ao excluir treino agendado." });
  }
};

async function idsInstituicoesAtuais(client: PrismaClient, atletaUsuarioId: string) {
  const atleta = await client.atleta.findUnique({
    where: { usuarioId: atletaUsuarioId },
    select: { id: true, clubeId: true, escolinhaId: true },
  });

  if (!atleta) return { atletaId: null, clubes: [], escolinhas: [], professores: [] as string[] };

  const rels = await client.relacaoTreinamento.findMany({
    where: { atletaId: atleta.id },
    select: { clubeId: true, escolinhaId: true, professorId: true },
  });

  const clubes = new Set<string>();
  const escolinhas = new Set<string>();
  const professores = new Set<string>();
  if (atleta.clubeId) clubes.add(atleta.clubeId);
  if (atleta.escolinhaId) escolinhas.add(atleta.escolinhaId);
  for (const r of rels) {
    if (r.clubeId) clubes.add(r.clubeId);
    if (r.escolinhaId) escolinhas.add(r.escolinhaId);
    if (r.professorId) professores.add(r.professorId);
  }

  return {
    atletaId: atleta.id,
    clubes: [...clubes],
    escolinhas: [...escolinhas],
    professores: [...professores],
  };
}

export async function getTreinosProgramadosStats(req: any, res: any) {
  try {
    const idsRaw = String(req.query.ids || "").trim();
    const ids = idsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res.json({ realizadoCountByTreinoId: {}, exerciciosCountByTreinoId: {} });
    }

    // 1) Conta "realizações" pela SUBMISSAO aprovada (melhor definição de "realizado")
    //   - Se no seu schema SubmissaoTreino tem relacao com TreinoAgendado -> treinoAgendado -> treinoProgramadoId
    //   - Ajuste nomes caso estejam diferentes
    const aprovadas = await prisma.submissaoTreino.groupBy({
      by: ["treinoAgendadoId"],
      where: {
        aprovado: true,
        treinoAgendado: {
          treinoProgramadoId: { in: ids },
        },
      },
      _count: { _all: true },
    });

    // Precisamos transformar por treinoProgramadoId:
    // Buscar os treinoAgendadoId -> treinoProgramadoId em lote
    const agIds = aprovadas.map((x) => x.treinoAgendadoId);
    const agMap = await prisma.treinoAgendado.findMany({
      where: { id: { in: agIds } },
      select: { id: true, treinoProgramadoId: true },
    });

    const treinoByAg: Record<string, string> = {};
    for (const a of agMap) treinoByAg[String(a.id)] = String(a.treinoProgramadoId);

    const realizadoCountByTreinoId: Record<string, number> = {};
    for (const row of aprovadas) {
      const agId = String(row.treinoAgendadoId);
      const treinoId = treinoByAg[agId];
      if (!treinoId) continue;
      realizadoCountByTreinoId[treinoId] =
        (realizadoCountByTreinoId[treinoId] || 0) + (row._count?._all || 0);
    }

    // 2) Conta exercícios por treinoProgramadoId (puxa da relação do treino programado)
    // Ajuste o include/relations se seu schema usa outra tabela (ex: treinoProgramadoExercicios)
    const treinos = await prisma.treinoProgramado.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        exercicios: { select: { id: true } }, // se for outra relation, troque aqui
      },
    });

    const exerciciosCountByTreinoId: Record<string, number> = {};
    for (const t of treinos) {
      exerciciosCountByTreinoId[String(t.id)] = Array.isArray(t.exercicios) ? t.exercicios.length : 0;
      // garante pelo menos 0 no realizado também
      if (realizadoCountByTreinoId[String(t.id)] == null) realizadoCountByTreinoId[String(t.id)] = 0;
    }

    return res.json({ realizadoCountByTreinoId, exerciciosCountByTreinoId });
  } catch (e) {
    console.error("[getTreinosProgramadosStats]", e);
    return res.status(500).json({ error: "Erro ao calcular stats dos treinos." });
  }
}

export async function getTreinosAgendados(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const atletaIdQuery =
      typeof req.query.atletaId === "string" ? req.query.atletaId.trim() : "";

    const apenasFuturos = String(req.query.apenasFuturos || "") === "1";
    const apenasComSubmissao = String(req.query.apenasComSubmissao || "") === "1";

    const agora = new Date();

    const inicioMes = startOfMonth(agora);
    const inicioProximoMes = addMonths(inicioMes, 1);

    let atletaId: string | null = null;
    let atletaUsuarioId: string | null = null;

    if (atletaIdQuery) {
      const at = await prisma.atleta.findUnique({
        where: { id: atletaIdQuery },
        select: { id: true, usuarioId: true },
      });
      if (!at) return res.json([]);
      atletaId = at.id;
      atletaUsuarioId = at.usuarioId;
    } else {
      const atletaUsuarioIdGuess = String(req.query.usuarioId || req.userId || "");
      if (!atletaUsuarioIdGuess) {
        return res.status(400).json({ error: "usuarioId ausente" });
      }

      const a = await prisma.atleta.findUnique({
        where: { usuarioId: atletaUsuarioIdGuess },
        select: { id: true, usuarioId: true },
      });
      if (!a) return res.json([]);
      atletaId = a.id;
      atletaUsuarioId = a.usuarioId;
    }

    const vinc = await idsInstituicoesAtuais(prisma, atletaUsuarioId!);

    const donoOr = [
      vinc.clubes.length ? { clubeId: { in: vinc.clubes } } : undefined,
      vinc.escolinhas.length ? { escolinhaId: { in: vinc.escolinhas } } : undefined,
      vinc.professores.length ? { professorId: { in: vinc.professores } } : undefined,
    ].filter(Boolean) as any[];

    const whereBase: any = { atletaId };

    if (donoOr.length) {
      whereBase.OR = [
        { treinoProgramadoId: null },
        { treinoProgramado: { is: { OR: donoOr } } },
      ];
    }

    const rows = await prisma.treinoAgendado.findMany({
      where: {
        AND: [
          whereBase,
          {
            OR: [
              { dataTreino: { gte: inicioMes, lt: inicioProximoMes } },
              { dataTreino: null },
            ],
          },
        ],
      },
      include: {
        treinoProgramado: {
          include: {
            exercicios: { include: { exercicio: true, exercicioTemporario: true } },
            professores: { include: { professor: { select: { id: true, nome: true } } } },
            Professor: { select: { id: true, nome: true } },
            clube: { select: { id: true, nome: true } },
            escolinha: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { dataTreino: "asc" },
    });

    const agIds = rows.map((r) => r.id);

    const tuRows = await prisma.treinoUsuario.findMany({
      where: {
        treinoId: { in: agIds },
        usuarioId: req.userId!,
      },
      select: {
        treinoId: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const tuMap = new Map(tuRows.map((r) => [r.treinoId, r]));

    const subRows = await prisma.submissaoTreino.findMany({
      where: {
        treinoAgendadoId: { in: agIds },
        atletaId,
      },
      select: {
        treinoAgendadoId: true,
        aprovado: true,
      },
    });

    const subMap = new Map<string, { enviados: number; aprovados: number }>();

    for (const s of subRows) {
      const k = s.treinoAgendadoId!;
      const cur = subMap.get(k) ?? { enviados: 0, aprovados: 0 };
      cur.enviados += 1;
      if (s.aprovado === true) cur.aprovados += 1;
      subMap.set(k, cur);
    }

    const normalizados = rows.map((r) => {
      const tu = tuMap.get(r.id);
      const sub = subMap.get(r.id) ?? { enviados: 0, aprovados: 0 };

      let meu: TreinoStatus = TreinoStatus.PENDING;

      if (sub.aprovados > 0) {
        meu = TreinoStatus.COMPLETED;
      } else if (tu?.status && tu.status !== TreinoStatus.COMPLETED) {
        meu = tu.status;
      } else if (r.dataExpiracao && r.dataExpiracao < agora) {
        meu = TreinoStatus.EXPIRED;
      }

      const dataTreinoIso = r.dataTreino ? new Date(r.dataTreino).toISOString() : null;
      const dataExpIso = r.dataExpiracao ? new Date(r.dataExpiracao).toISOString() : null;
      const dataOriginalIso = r.dataOriginal ? new Date(r.dataOriginal).toISOString() : null;

      return {
        ...r,
        dataTreino: dataTreinoIso,
        dataExpiracao: dataExpIso,
        dataOriginal: dataOriginalIso,
        treinoProgramado: r.treinoProgramado
          ? {
              ...r.treinoProgramado,
              exercicios: r.treinoProgramado.exercicios.map((e: any) => {
                const exRef = e.exercicio ?? e.exercicioTemporario;
                return {
                  repeticoes: e.repeticoes ?? "",
                  exercicio: {
                    id: exRef?.id ?? "",
                    nome: exRef?.nome ?? "",
                    videoDemonstrativoUrl: exRef?.videoDemonstrativoUrl ?? null,
                  },
                };
              }),
            }
          : null,
        meuStatus: meu,
        startedAt: tu?.startedAt ?? null,
        completedAt: tu?.completedAt ?? null,
        submissao: {
          enviados: sub.enviados,
          aprovados: sub.aprovados,
          feito: sub.aprovados > 0,
        },
      };
    });

    let resultado = normalizados;

    if (apenasFuturos) {
      const hoje = startOfDay(new Date());
      resultado = resultado.filter((r: any) => {
        if (!r.dataTreino) return true; 
        const dt = new Date(r.dataTreino);
        if (Number.isNaN(dt.getTime())) return true;
        return dt >= hoje;
      });
    }

    if (apenasComSubmissao) {
      resultado = resultado.filter((r: any) => (r.submissao?.enviados ?? 0) > 0);
    }

    return res.json(resultado);
  } catch (e) {
    console.error("getTreinosAgendados", e);
    return res.status(500).json({ error: "Erro ao buscar treinos agendados" });
  }
}


export async function concluirTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId!;
    const treinoAgendadoId = String((req.body?.treinoAgendadoId ?? req.params?.id) || "");

    let {
      atletaId,
      pontos,
      tempoSeg,
      repeticoes,
      duracaoMinutos,
    } = (req.body ?? {}) as {
      atletaId?: string;
      pontos?: number;
      tempoSeg?: number;
      repeticoes?: number;
      duracaoMinutos?: number;
    };

    if (!atletaId) {
      const at = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true } });
      atletaId = at?.id || "";
    }
    if (!treinoAgendadoId || !atletaId) {
      return res.status(400).json({ error: "treinoAgendadoId e atletaId são obrigatórios" });
    }

    const agendado = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      include: {
        atleta: { select: { usuarioId: true } },
        treinoProgramado: {
          select: { pontuacao: true, duracao: true, tipoTreino: true, nome: true },
        },
      },
    });
    if (!agendado) return res.status(404).json({ error: "Treino agendado não encontrado" });
    if (agendado.atleta?.usuarioId !== usuarioId) {
      return res.status(403).json({ error: "Você não pode concluir este treino" });
    }

    const titulo = agendado.treinoProgramado?.nome ?? agendado.titulo ?? "Treino";
    let conteudo = `🏅 Concluí o treino: ${titulo}`;
    if (Number.isFinite(Number(repeticoes))) conteudo += ` — ${repeticoes} rep.`;
    if (Number.isFinite(Number(tempoSeg))) conteudo += ` — ${Math.round(Number(tempoSeg))}s`;

    const post = await prisma.postagem.create({
      data: { usuarioId, conteudo, tipoMidia: TipoMidia.Documento, imagemUrl: null, videoUrl: null },
      include: {
        usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
        curtidas: true,
        comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
      },
    });

    const segs = await prisma.seguidor.findMany({
      where: { seguidoUsuarioId: usuarioId },
      select: { seguidorUsuarioId: true },
    });
    getIO()
      ?.to([`u:${usuarioId}`, ...segs.map((s) => `u:${s.seguidorUsuarioId}`)])
      .emit("feed:novoPost", post);

    const pontosTemplate =
      typeof pontos === "number" && pontos >= 0
        ? pontos
        : agendado.treinoProgramado?.pontuacao ?? 0;

    const obs = req.body?.observacao ? sanitizeText(req.body.observacao, 800) : null;
    if (obs) {
      const fail = basicModerationFails(obs);
      if (fail) return res.status(422).json({ message: fail });
    }

    const duracaoFinal = Number.isFinite(Number(duracaoMinutos))
      ? Number(duracaoMinutos)
      : agendado.treinoProgramado?.duracao ?? undefined;

    const temVinc = await atletaTemVinculo(atletaId);

    const existenteSub = await prisma.submissaoTreino.findFirst({
      where: { atletaId, treinoAgendadoId },
      orderBy: { criadoEm: "desc" },
    });

    const dataCommon: any = {
      aprovado: temVinc ? null : true,
      pontuacaoSnapshot: temVinc ? undefined : pontosTemplate,
      pontosCreditados: temVinc ? undefined : pontosTemplate,
      duracaoMinutos: duracaoFinal,
      treinoTituloSnapshot: agendado.treinoProgramado?.nome ?? agendado.titulo ?? undefined,
      tipoTreinoSnapshot: agendado.treinoProgramado?.tipoTreino ?? undefined,
      tempoSeg: Number.isFinite(Number(tempoSeg)) ? Number(tempoSeg) : undefined,
      repeticoes: Number.isFinite(Number(repeticoes)) ? Number(repeticoes) : undefined,
      observacao: obs ?? undefined,
    };
  
    if (req.user?.plano !== "PRO") {
      const ok = await requireUsage(req, res, "treinos_semana");
      if (!ok) return;
    }

    const submissao = existenteSub
      ? await prisma.submissaoTreino.update({ where: { id: existenteSub.id }, data: dataCommon })
      : await prisma.submissaoTreino.create({ data: { atletaId, treinoAgendadoId, ...dataCommon } });

    const aprovadoAgora = dataCommon.aprovado === true;
    const jaAprovadaAntes = existenteSub?.aprovado === true;

    if (aprovadoAgora && !jaAprovadaAntes) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(submissao.id);
      } catch (e) {
        console.warn("stats (feito por aluno) falhou no concluirTreino:", e);
      }
    }

    await prisma.treinoUsuario.upsert({
      where: { treinoId_usuarioId: { treinoId: treinoAgendadoId, usuarioId } },
      update: { status: TreinoStatus.COMPLETED, completedAt: new Date() },
      create: {
        treinoId: treinoAgendadoId,
        usuarioId,
        status: TreinoStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    res.json({
      ok: true,
      pontos: temVinc ? 0 : pontosTemplate,
      submissao,
      pendenteValidacao: temVinc,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao concluir treino" });
  }
}

export async function iniciarTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const treinoAgendadoId = req.params.id;
    const usuarioId = req.userId!;

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      select: { atleta: { select: { usuarioId: true } } },
    });
    if (!ag) return res.status(404).json({ error: "Treino agendado não encontrado" });
    if (ag.atleta?.usuarioId !== usuarioId)
      return res.status(403).json({ error: "Você não pode iniciar este treino" });

    const started = await prisma.treinoUsuario.upsert({
      where: { treinoId_usuarioId: { treinoId: treinoAgendadoId, usuarioId } },
      create: { treinoId: treinoAgendadoId, usuarioId, status: TreinoStatus.IN_PROGRESS, startedAt: new Date() },
      update: { status: TreinoStatus.IN_PROGRESS, startedAt: new Date() },
    });
    res.json({ ok: true, started, startedAt: started.startedAt });
  } catch (e) {
    console.error("iniciarTreino", e);
    res.status(500).json({ error: "Erro ao iniciar treino" });
  }
}

export async function getExercicios(_req: Request, res: Response) {
  try {
    const exercicios = await prisma.exercicio.findMany();
    return res.json(exercicios);
  } catch (err) {
    console.error("Erro ao buscar exercícios:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getPontuacoes(req: Request, res: Response) {
  try {
    const raw = (req.query.atletaIds as string) || "";
    const atletaIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!atletaIds.length) return res.status(400).json({ error: "Informe 1+ atletaIds" });

    const rows = await prisma.pontuacaoAtleta.findMany({
      where: { atletaId: { in: atletaIds } },
      select: {
        atletaId: true,
        pontuacaoTotal: true,
        pontuacaoPerformance: true,
        pontuacaoDisciplina: true,
        pontuacaoResponsabilidade: true,
        ultimaAtualizacao: true,
      },
    });

    const payload = rows.map((r) => {
      const mediaGeral = Math.round(
        (r.pontuacaoPerformance + r.pontuacaoDisciplina + r.pontuacaoResponsabilidade) / 3
      );
      return {
        atletaId: r.atletaId,
        total: r.pontuacaoTotal,
        performance: r.pontuacaoPerformance,
        disciplina: r.pontuacaoDisciplina,
        responsabilidade: r.pontuacaoResponsabilidade,
        mediaGeral,
        ultimaAtualizacao: r.ultimaAtualizacao,
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error("Erro ao buscar pontuações:", err);
    return res.status(500).json({ error: "Erro ao buscar pontuações" });
  }
}

async function getEscalaCore(elencoId: string, res: Response) {
  try {
    const elenco = await prisma.elenco.findUnique({
      where: { id: elencoId },
      select: {
        id: true,
        nome: true,
        maxJogadores: true,
        escala: true,
        formacao: true,
      },
    });

    if (!elenco) {
      return res.json(null);
    }

    const escala =
      (elenco.escala as Record<string, string | null> | null) ?? null;

    const formacao =
      (elenco.formacao as
        | { defesa: number; meio: number; atacantes: number }
        | null) ?? null;

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,   
      formacao, 
    });
  } catch (err) {
    console.error("Erro ao buscar escala do elenco:", err);
    return res
      .status(500)
      .json({ error: "Erro ao buscar escala do elenco" });
  }
}

export async function getEscalaPorElencoId(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "id é obrigatório" });
  return getEscalaCore(id, res);
}

export async function getEscalaPorDono(req: Request, res: Response) {
  try {
    const raw = (req.query.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw).trim();
    if (!tipoUsuarioId) {
      return res
        .status(400)
        .json({ error: "tipoUsuarioId é obrigatório" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: {
        ativo: true,
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elenco) return res.json(null);

    return getEscalaCore(elenco.id, res);
  } catch (err) {
    console.error("Erro ao buscar escala por dono:", err);
    return res
      .status(500)
      .json({ error: "Erro ao buscar escala por dono" });
  }
}

export async function listarSubmissoesParaValidacao(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuarioId = String((req.query.tipoUsuarioId ?? "") as string).trim();
    const status = String((req.query.status ?? "pendente") as string).toLowerCase();

    const resolved = await resolveEntidade(tipoUsuarioId || req.userId!);
    if (!resolved) return res.json({ items: [], total: 0, limit: 0, offset: 0 });

    const atletaIds = new Set<string>();
    const whereRel =
      resolved.tipo === "professor"
        ? { professorId: resolved.id }
        : resolved.tipo === "clube"
        ? { clubeId: resolved.id }
        : { escolinhaId: resolved.id };

    const rels = await prisma.relacaoTreinamento.findMany({
      where: { ...whereRel, atletaId: { not: null } },
      select: { atletaId: true },
    });
    rels.forEach((r) => r.atletaId && atletaIds.add(r.atletaId));

    if (resolved.tipo === "clube") {
      const diretos = await prisma.atleta.findMany({
        where: { clubeId: resolved.id },
        select: { id: true },
      });
      diretos.forEach((a) => atletaIds.add(a.id));
    }
    if (resolved.tipo === "escolinha") {
      const diretos = await prisma.atleta.findMany({
        where: { escolinhaId: resolved.id },
        select: { id: true },
      });
      diretos.forEach((a) => atletaIds.add(a.id));
    }

    if (atletaIds.size === 0) {
      return res.json({ items: [], total: 0, limit: 0, offset: 0 });
    }

    const where: any = { atletaId: { in: Array.from(atletaIds) } };
    switch (status) {
      case "pendente":
        where.OR = [
          { aprovado: { equals: null } },
          { AND: [{ aprovado: false }, { OR: [{ pontosCreditados: { equals: null } }, { pontosCreditados: 0 }] }] },
        ];
        break;
      case "aprovados":
      case "aprovadas":
        where.aprovado = true;
        break;
      case "reprovados":
      case "reprovadas":
        where.aprovado = false;
        break;
    }

    const orderBy = { criadoEm: "desc" as const };
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [subs, total] = await prisma.$transaction([
      prisma.submissaoTreino.findMany({
        where,
        include: {
          atleta: { select: { id: true, nome: true, foto: true, usuarioId: true } },
          treinoAgendado: {
            select: {
              id: true,
              titulo: true,
              treinoProgramado: { select: { id: true, nome: true, pontuacao: true } },
            },
          },
          midias: { select: { url: true } },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.submissaoTreino.count({ where }),
    ]);

    const items = subs.map((s) => {
      const pontosBase = s.pontuacaoSnapshot ?? s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
      return {
        id: s.id,
        criadoEm: s.criadoEm instanceof Date ? s.criadoEm.toISOString() : (s as any).criadoEm,
        aprovado: s.aprovado,
        pontosSugeridos: pontosBase || 0,
        atleta: {
          id: s.atleta?.id,
          usuarioId: s.atleta?.usuarioId,
          nome: s.atleta?.nome ?? "",
          foto: s.atleta?.foto ?? null,
        },
        treino: {
          agendadoId: s.treinoAgendado?.id,
          titulo:
            s.treinoAgendado?.titulo ??
            s.treinoAgendado?.treinoProgramado?.nome ??
            "Treino",
          programadoId: s.treinoAgendado?.treinoProgramado?.id ?? null,
        },
        midias: s.midias?.map((m) => m.url) ?? [],
      };
    });

    return res.json({ items, total, limit, offset });
  } catch (err) {
    console.error("Erro em listarSubmissoesParaValidacao:", err);
    return res.status(500).json({ message: "Erro ao buscar submissões" });
  }
}

export async function listarElencos(req: Request, res: Response) {
  try {
    const raw = (req.query.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw).trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

    const elencos = await prisma.elenco.findMany({
      where: {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
        ativo: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elencos.length) return res.json([]);

    const elencoIds = elencos.map((e) => e.id);
    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: { in: elencoIds } },
    });

    const porElenco = new Map<string, { atletaId: string; posicao: PosicaoCampo }[]>();
    for (const v of vinculos) {
      const arr = porElenco.get(v.elencoId) ?? [];
      arr.push({ atletaId: v.atletaId, posicao: v.posicao });
      porElenco.set(v.elencoId, arr);
    }

    const resposta = elencos.map((e) => ({ ...e, atletas: porElenco.get(e.id) ?? [] }));
    return res.json(resposta);
  } catch (err) {
    console.error("Erro ao listar elencos:", err);
    return res.status(500).json({ error: "Erro ao listar elencos" });
  }
}

export async function criarElenco(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      nome,
      maxJogadores = 11,
      tipoUsuario,
      tipoUsuarioId,
      atletas,
      escala,
      ativo = true,
      turmaId,
    } = req.body as {
      nome?: string;
      maxJogadores?: number;
      tipoUsuario?: "professor" | "escolinha" | "clube";
      tipoUsuarioId?: string;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
      ativo?: boolean;
      turmaId?: string | null;
    };

    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }
    if (!tipoUsuario || !["professor", "escolinha", "clube"].includes(tipoUsuario)) {
      return res.status(400).json({ error: "tipoUsuario inválido" });
    }

    const turmaIdFinal =
      typeof turmaId === "string" && turmaId.trim().length > 0
        ? turmaId.trim()
        : null;

    const dataCreate: any = {
      nome,
      maxJogadores,
      ativo,
      turmaId: turmaIdFinal,
    };

    if (tipoUsuario === "professor") dataCreate.professorId = tipoUsuarioId;
    if (tipoUsuario === "escolinha") dataCreate.escolinhaId = tipoUsuarioId;
    if (tipoUsuario === "clube") dataCreate.clubeId = tipoUsuarioId;

    const elenco = await prisma.elenco.create({ data: dataCreate });

    let vinculos: { atletaId: string; posicao: PosicaoCampo }[] = [];

    if (Array.isArray(atletas) && atletas.length) {
      vinculos = atletas;
    } else if (escala && typeof escala === "object") {
      vinculos = Object.entries(escala)
        .filter(([, atletaId]) => !!atletaId)
        .map(([pos, atletaId]) => ({
          posicao: pos as PosicaoCampo,
          atletaId: atletaId as string,
        }));
    }

    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map((v) => ({
          elencoId: elenco.id,
          atletaId: v.atletaId,
          posicao: v.posicao,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao criar elenco:", err);
    return res.status(500).json({ error: "Erro ao criar elenco" });
  }
}

export async function atualizarAgendamento(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { dataTreino } = req.body;

  const dt = dataTreino ? parseDateInput(dataTreino) : null;
  if (dt && Number.isNaN(dt.getTime())) {
    return res.status(400).json({ message: "dataTreino inválida" });
  }
  const row = await prisma.treinoAgendado.update({
    where: { id },
    data: { dataTreino: dt },
  });

  await audit(req, {
    acao: 'ALTERAR_AGENDA',
    entidade: 'TreinoAgendado',
    entidadeId: id,
    descricao: 'Agendamento alterado',
    meta: { atletaId: row.atletaId, dataTreino: row.dataTreino, status: 'Agendado' },
  });

  return res.json(row);
}

export async function atualizarElenco(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, maxJogadores, ativo, atletas, escala, turmaId } = req.body as {
      nome?: string;
      maxJogadores?: number;
      ativo?: boolean;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
      turmaId?: string | null;
    };

    const exists = await prisma.elenco.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: "Elenco não encontrado" });

    const dono = {
      professorId: exists.professorId ?? null,
      clubeId: exists.clubeId ?? null,
      escolinhaId: exists.escolinhaId ?? null,
    };

    const vinculadosAtuais = await prisma.atletaElenco.findMany({
      where: { elencoId: id },
      select: { atletaId: true },
    });

    const dataUpdate: any = {};
    if (typeof nome === "string") dataUpdate.nome = nome;
    if (typeof maxJogadores === "number") dataUpdate.maxJogadores = maxJogadores;
    if (typeof ativo === "boolean") dataUpdate.ativo = ativo;
    if (typeof turmaId === "string") {
      dataUpdate.turmaId = turmaId.trim().length ? turmaId.trim() : null;
    }

    const elenco = await prisma.elenco.update({ where: { id }, data: dataUpdate });

    let vinculos: { atletaId: string; posicao: PosicaoCampo }[] = [];
    if (Array.isArray(atletas) && atletas.length) {
      vinculos = atletas;
    } else if (escala && typeof escala === "object") {
      vinculos = Object.entries(escala)
        .filter(([, atletaId]) => !!atletaId)
        .map(([pos, atletaId]) => ({
          posicao: pos as PosicaoCampo,
          atletaId: atletaId as string,
        }));
    }

    await prisma.atletaElenco.deleteMany({ where: { elencoId: id } });

    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map((v) => ({
          elencoId: id,
          atletaId: v.atletaId,
          posicao: v.posicao,
        })),
        skipDuplicates: true,
      });
    }

    const setNovos = new Set(vinculos.map((v) => v.atletaId));
    const removidos = vinculadosAtuais
      .map((v) => v.atletaId)
      .filter((a) => !setNovos.has(a));

    if (removidos.length) {
      await prisma.treinoAgendado.updateMany({
        where: {
          atletaId: { in: removidos },
          treinoProgramado: {
            is: {
              OR: [
                ...(dono.clubeId ? [{ clubeId: dono.clubeId }] : []),
                ...(dono.escolinhaId ? [{ escolinhaId: dono.escolinhaId }] : []),
                ...(dono.professorId ? [{ professorId: dono.professorId }] : []),
              ],
            },
          },
        },
        data: { dataExpiracao: new Date() },
      });
    }

    return res.json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao atualizar elenco:", err);
    return res.status(500).json({ error: "Erro ao atualizar elenco" });
  }
}

export const atletasVinculados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let tipoUsuarioId =
      (typeof req.query.tipoUsuarioId === "string" && req.query.tipoUsuarioId.trim()) ||
      (typeof req.query.professorId === "string" && req.query.professorId.trim()) ||
      "";

    const turmaId =
      typeof req.query.turmaId === "string" && req.query.turmaId.trim()
        ? String(req.query.turmaId)
        : undefined;

    const incluirPontuacao = String(req.query.incluirPontuacao ?? "") === "1";

    if (!tipoUsuarioId) {
      return res.json([]);
    }

    const whereBase: Prisma.AtletaWhereInput = {
      OR: [
        { relacoesTreinamento: { some: { professorId: tipoUsuarioId } } },
        { clubeId: tipoUsuarioId },
        { escolinhaId: tipoUsuarioId },
      ],
    };

    if (turmaId) {
      const membros = await prisma.turmaUsuario.findMany({
        where: { turmaId },
        select: { usuarioId: true },
      });
      const usuarioIds = membros.map((m) => m.usuarioId);

      whereBase.usuarioId = {
        in: usuarioIds.length ? usuarioIds : ["__none__"],
      };
    }

    const selectBase: any = {
      id: true,
      usuarioId: true,
      idade: true,
      posicao: true,
      categoria: true,
      usuario: {
        select: {
          nome: true,
          foto: true,
        },
      },
    };

    if (incluirPontuacao) {
      selectBase.pontuacao = {
        select: {
          pontuacaoTotal: true,
        },
      };
    }

const atletasRaw = await prisma.atleta.findMany({
  where: whereBase,
  select: selectBase,
  orderBy: { usuario: { nome: "asc" } },
});

type AtletaComUsuarioEPontuacao = {
  id: string;
  usuarioId: string | null;
  idade: number | null;
  posicao: any;
  categoria: string[] | null;
  usuario?: {
    nome: string | null;
    foto: string | null;
  } | null;
  pontuacao?: {
    pontuacaoTotal: number | null;
  } | null;
};

const atletas = atletasRaw as unknown as AtletaComUsuarioEPontuacao[];

const payload = atletas.map((a) => ({
  id: a.id,
  usuarioId: a.usuarioId,
  atletaId: a.id,
  nome: a.usuario?.nome ?? "Atleta",
  foto: a.usuario?.foto ?? null,
  idade: a.idade ?? null,
  posicao: a.posicao ?? null,
  categoria:
    Array.isArray(a.categoria) && a.categoria.length
      ? a.categoria[0]
      : null,
  pontuacao: a.pontuacao?.pontuacaoTotal ?? null,
}));

    return res.json(payload);
  } catch (e) {
    console.error("GET /treinos/atletas-vinculados erro:", e);
    return res.status(500).json({ error: "Erro ao listar atletas vinculados" });
  }
};

export async function restaurarTreinos(req: Request, res: Response) {
  const { nomes } = req.body as { nomes: string[] };
  if (!Array.isArray(nomes) || nomes.length === 0) {
    return res.status(400).json({ error: "Informe 'nomes: string[]'." });
  }
  const ops = nomes.map((nome) =>
    prisma.treinoProgramado.upsert({
      where: { nome },
      update: { naoExpira: true, dataAgendada: null },
      create: {
        nome,
        codigo: `${nome}-${Date.now()}`,
        nivel: Nivel.Base,
        tipoTreino: TipoTreino.Fisico,
        categoria: [],
        duracao: 60,
        pontuacao: 15,
        dicas: [],
        naoExpira: true,
        dataAgendada: null,
      },
    })
  );
  await Promise.all(ops);
  return res.json({ ok: true, restaurados: nomes.length });
}

export async function criarTreinoProgramado(
  req: AuthenticatedRequest,
  res: Response
) {
  let user: any = getUserFromReq(req);

  if (!user) {
    const authHeader =
      (req.headers.authorization as string | undefined) ||
      (req.headers.Authorization as string | undefined);

    if (authHeader) {
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      try {
        user = jwt.verify(token, JWT_SECRET) as any;
        (req as any).user = user;
        (req as any).userId = user.id;
      } catch (e) {
        console.error("[criarTreinoProgramado] Erro ao decodificar JWT:", e);
      }
    }
  }

  if (!user) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  const tipoStr = String(user.tipo ?? user.tipoUsuario ?? "").toLowerCase();
  if (!user.plano) {
    user.plano = "FREE";
  }

  user.plano = String(user.plano ?? "FREE").trim().toUpperCase();

  const isOrganizador =
    tipoStr === "professor" ||
    tipoStr === "clube" ||
    tipoStr === "escolinha";

  if (!can(user, CAP_CRIAR_TREINO) && !isOrganizador) {
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "Seu plano não permite criar novos treinos programados.",
    });
  }

  const ok = await requireUsage(req as any, res, "treinos_programados_mes");
  if (!ok) return;

  try {
    const {
      nome,
      descricao,
      nivel,
      exercicios,
      usuarioId,
      categoria,
      tipoTreino,
      objetivo,
      duracao,
      dataTreino,
      dataAgendada,
      dicas,
      tipoUsuario,
      tipoUsuarioId,
      atletasIds = [],
      elencosIds = [],
      pontuacao,
    } = req.body as any;

    if (!(Object.values(Nivel) as string[]).includes(String(nivel))) {
      return res.status(400).json({ message: "Nivel inválido" });
    }
    const nivelEnum = nivel as Nivel;

    const usuarioIdToken = req.userId || user?.id;

    if (!nome || !nivel || !Array.isArray(exercicios) || !tipoUsuarioId || !usuarioIdToken) {
      console.warn("[criarTreinoProgramado] Dados inválidos:", {
        nome,
        nivel,
        exerciciosEhArray: Array.isArray(exercicios),
        tipoUsuarioId,
        usuarioIdToken,
      });
      return res.status(400).json({ error: "Dados inválidos" });
    }

    let categorias: Categoria[] = [];
    try {
      categorias = normalizeCategorias(categoria);
    } catch {
      return res.status(400).json({ error: "Categoria(s) inválida(s)" });
    }

    let tipoTreinoNorm: TipoTreino | undefined = undefined;
    if (tipoTreino !== undefined) {
      tipoTreinoNorm = normalizeTipoTreino(tipoTreino);
      if (!tipoTreinoNorm && tipoTreino !== null) {
        return res.status(400).json({ message: "TipoTreino inválido" });
      }
    }

    const when = dataTreino || dataAgendada || null;
    const tipoNorm =
      typeof tipoUsuario === "string"
        ? (tipoUsuario as string).toLowerCase()
        : null;

    const pontuacaoNum =
      Number.isFinite(Number(pontuacao))
        ? Math.max(0, Math.floor(Number(pontuacao)))
        : null;

    if (tipoStr === "professor" && !can(user, FEAT.TREINOS_ILIMITADOS)) {
      const profId = String(tipoUsuarioId);
      const ativos = await prisma.treinoProgramado.count({
        where: {
          NOT: [{ naoExpira: true }],
          OR: [
            { professorId: profId },
            { professores: { some: { professorId: profId } } },
          ],
        }
      });

      const limAtivos = planLimitFor(user.plano ?? "FREE", "planos_ativos_total");
      if (ativos >= limAtivos) {
        return res.status(402).json({
          code: "UPGRADE_REQUIRED",
          message:
            "Você atingiu o limite de planos/rotinas ativos para o seu plano.",
        });
      }
    }

    if (tipoStr === "professor" && !can(user, FEAT.ROTINAS_ILIMITADAS)) {
      const profId = String(tipoUsuarioId);
      const templates = await prisma.treinoProgramado.count({
        where: { professorId: profId, naoExpira: true },
      });

      const limTpl = planLimitFor(user.plano ?? "FREE", "templates_total");
      if (templates >= limTpl) {
        return res.status(402).json({
          code: "UPGRADE_REQUIRED",
          message: "Você atingiu o limite de templates salvos para o seu plano.",
        });
      }
    }

    const whenDate = when ? parseDateInput(when) : null;
      if (whenDate && Number.isNaN(whenDate.getTime())) {
        return res.status(400).json({ message: "dataAgendada inválida" });
      }

    const professorLogadoId =
      tipoStr === "professor" ? String(tipoUsuarioId).trim() : "";

    const body = req.body as any;

    const professorCriadorId =
      tipoStr === "professor" ? String(tipoUsuarioId).trim() : "";

    const colaboradoresEntradaRaw =
      body.colaboradoresProfessorIds ??
      body.professoresIds ??
      body.colaboradoresIds ??
      body.criadoresIds ??
      [];

    const colaboradoresEntrada: string[] = Array.isArray(colaboradoresEntradaRaw)
      ? (colaboradoresEntradaRaw as unknown[]).map((v: unknown) => String(v).trim()).filter(Boolean)
      : typeof colaboradoresEntradaRaw === "string"
      ? colaboradoresEntradaRaw.split(",").map((v: string) => v.trim()).filter(Boolean)
      : [];

    const colaboradoresEntradaUniq = [...new Set(colaboradoresEntrada)].filter(
      (id) => id && id !== professorCriadorId
    );

    let colaboradoresProfessorIds: string[] = [];
    if (colaboradoresEntradaUniq.length) {
      const profs = await prisma.professor.findMany({
        where: {
          OR: [
            { id: { in: colaboradoresEntradaUniq } },
            { usuarioId: { in: colaboradoresEntradaUniq } },
          ],
        },
        select: { id: true },
      });

      colaboradoresProfessorIds = profs.map((p) => p.id);

      const setOk = new Set(colaboradoresProfessorIds);
      
      if (profs.length !== colaboradoresEntradaUniq.length) {
        return res.status(400).json({
          message:
            "Um ou mais colaboradores são inválidos (não encontrei professor por id/usuarioId).",
          recebidos: colaboradoresEntradaUniq,
          encontrados: colaboradoresProfessorIds,
        });
      }
    }

    const treino = await prisma.treinoProgramado.create({
      data: {
        codigo: typeof body.codigo === "string" ? body.codigo.trim() : undefined,
        nome: String(nome).trim(),
        descricao: descricao ?? null,
        nivel: nivelEnum,
        tipoTreino: tipoTreinoNorm ?? null,
        categoria: categorias,
        dicas: Array.isArray(dicas) ? dicas : [],
        duracao: duracao != null ? Number(duracao) : null,
        objetivo: objetivo ?? null,
        dataAgendada: whenDate,

        pontuacao: pontuacaoNum,

        ...(tipoNorm === "professor" ? { professorId: String(tipoUsuarioId) } : {}),
        ...(tipoNorm === "clube" ? { clubeId: String(tipoUsuarioId) } : {}),
        ...(tipoNorm === "escolinha" ? { escolinhaId: String(tipoUsuarioId) } : {}),
        ...(professorCriadorId ? { criadorProfessorId: professorCriadorId } : {}),

        professores: colaboradoresProfessorIds.length
          ? {
              createMany: {
                data: colaboradoresProfessorIds.map((professorId) => ({
                  professorId,
                  papel: "COLABORADOR",
                })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
    });

    // ✅ stats: contar inclusões de exercícios (1 vez por exercício no treino)
    const exercicioIds = Array.from(
      new Set(
        (Array.isArray(exercicios) ? exercicios : [])
          .map((e: any) => String(e?.exercicioId ?? "").trim())
          .filter(Boolean)
      )
    );

    if (exercicioIds.length) {
      const professorIdForStats =
        tipoNorm === "professor" ? String(tipoUsuarioId).trim() : null;

      await Promise.all(
        exercicioIds.map((exercicioId) =>
          onExercicioIncluidoNoTreino({
            treinoId: treino.id,
            exercicioId,
            professorId: professorIdForStats,
          })
        )
      );
    }

    const exsBanco = (exercicios as any[]).filter((e) => e.exercicioId);
    const exsTemp = (exercicios as any[]).filter(
      (e) => !e.exercicioId && e.nome
    );

    if (exsBanco.length) {
      await prisma.treinoProgramadoExercicio.createMany({
        data: exsBanco.map((e, i) => ({
          treinoProgramadoId: treino.id,
          exercicioId: e.exercicioId,
          repeticoes: String(e.repeticoes ?? ""),
          ordem: e.ordem ?? i + 1,
        })),
      });
    }

  for (const [i, e] of exsTemp.entries()) {
  const nomeTemp = String(e.nome ?? "").trim();
  if (!nomeTemp) continue;

  const videoHerdado = await herdarVideoParaTemporario(nomeTemp);

  let temp = await prisma.exercicioTemporario.findFirst({
    where: {
      treinoProgramadoId: treino.id,
      nome: { equals: nomeTemp, mode: "insensitive" },
    },
    select: { id: true, videoDemonstrativoUrl: true },
  });

  if (!temp) {
    temp = await prisma.exercicioTemporario.create({
      data: {
        treinoProgramadoId: treino.id,
        codigo: null,
        nome: nomeTemp,
        descricao: e.descricao ?? null,
        nivel: nivelEnum,
        categorias,
        videoDemonstrativoUrl: videoHerdado ?? null,
      },
      select: { id: true, videoDemonstrativoUrl: true },
    });
  } else if ((!temp.videoDemonstrativoUrl || temp.videoDemonstrativoUrl === "") && videoHerdado) {
    await prisma.exercicioTemporario.update({
      where: { id: temp.id },
      data: { videoDemonstrativoUrl: videoHerdado },
    });
  }

  await prisma.treinoProgramadoExercicio.create({
    data: {
      treinoProgramadoId: treino.id,
      exercicioTemporarioId: temp.id,
      repeticoes: String(e.repeticoes ?? ""),
      ordem: e.ordem ?? exsBanco.length + i + 1,
    },
  });
}

    const atletasFromElencos = elencosIds.length
      ? await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencosIds } },
          select: { atletaId: true },
        })
      : [];

    const atletasUniqRaw = Array.from(
      new Set([
        ...(atletasIds || []),
        ...atletasFromElencos.map((a) => a.atletaId),
      ])
    );

    const atletasResolvidos = atletasUniqRaw.length
      ? await prisma.atleta.findMany({
          where: {
            OR: [
              { id: { in: atletasUniqRaw } },
              { usuarioId: { in: atletasUniqRaw } },
            ],
          },
          select: { id: true },
        })
      : [];

    const atletaIdsResolved: string[] = Array.from(
      new Set(atletasResolvidos.map((a) => a.id))
    );

    if (atletaIdsResolved.length > 0) {
      try {
        const whenDate = treino.dataAgendada ?? new Date();
        const dataExpiracao = new Date(
          whenDate.getTime() + 3 * 24 * 60 * 60 * 1000
        );

        await prisma.treinoAgendado.createMany({
          data: atletaIdsResolved.map((atletaId) => ({
            titulo: treino.nome,
            atletaId,
            treinoProgramadoId: treino.id,
            dataTreino: whenDate,
            dataExpiracao,
            dataOriginal: whenDate,
            status: TreinoAgendadoStatus.AGENDADO,
          })),
          skipDuplicates: true,
        });

      } catch (e) {
        console.error(
          "[criarTreinoProgramado] ERRO ao auto-agendar para atletas (não é crítico):",
          e
        );
      }
    }

    return res.status(201).json(treino);
  } catch (err: any) {
    console.error(
      "Erro ao criar treino (catch geral):",
      err?.message,
      err?.code,
      err?.meta,
      err
    );
    return res
      .status(500)
      .json({ error: "Erro ao criar treino", detalhe: err?.message });
  }
}

export async function atualizarTreinoProgramado(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    let {
      nome,
      codigo,
      descricao,
      nivel,
      categoria,
      tipoTreino,
      dataAgendada,
      objetivo,
      duracao,
      dicas,
      imagemUrl,
      metas,
      pontuacao,
      expiraEm,
      naoExpira,
      exercicios = [],
      tipoUsuario,
      tipoUsuarioId,
    } = req.body as any;

    if (nome || codigo) {
      const dup = await prisma.treinoProgramado.findFirst({
        where: { id: { not: id }, OR: [{ nome: nome ?? "" }, { codigo: codigo ?? "" }] },
        select: { id: true, nome: true, codigo: true },
      });
      if (dup) {
        return res
          .status(400)
          .json({ message: "Já existe treino com esse nome ou código.", duplicado: dup });
      }
    }

    let categoriasNorm: Categoria[] | undefined = undefined;
    if (categoria !== undefined) {
      try {
        categoriasNorm = normalizeCategorias(categoria);
      } catch {
        return res.status(400).json({ message: "Categoria(s) inválida(s)" });
      }
    }

    const tipoTreinoNorm = tipoTreino !== undefined ? ((): TipoTreino | undefined => {
      const s = String(tipoTreino).toLowerCase();
      if (s === "fisico" || s === "físico") return "Fisico";
      if (s === "tecnico" || s === "técnico") return "Tecnico";
      if (s === "tatico" || s === "tático") return "Tatico";
      if (s === "mental") return "Mental";
      return (Object.values(TipoTreino) as string[]).includes(String(tipoTreino)) ? tipoTreino as TipoTreino : undefined;
    })() : undefined;

    if (tipoTreino !== undefined && !tipoTreinoNorm) {
      return res.status(400).json({ message: "TipoTreino inválido" });
    }

    const donoUpdate: any = {};
    if (tipoUsuario || tipoUsuarioId) {
      const s = String(tipoUsuario || "").toLowerCase();
      donoUpdate.professor = { disconnect: true };
      donoUpdate.clube = { disconnect: true };
      donoUpdate.escolinha = { disconnect: true };
      if (s === "professor") donoUpdate.professor = { connect: { id: tipoUsuarioId } };
      if (s === "clube") donoUpdate.clube = { connect: { id: tipoUsuarioId } };
      if (s === "escolinha" || s === "escola") {
        donoUpdate.escolinha = { connect: { id: tipoUsuarioId } };
      }
    }

    const exs: any[] = Array.isArray(exercicios) ? exercicios : [];
    const exsBanco = exs.filter((e) => e.exercicioId);
    const exsTemp = exs.filter((e) => !e.exercicioId && e.nome);

    const antigos = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId: id },
      select: { exercicioId: true },
    });
    const antigosSet = new Set(antigos.map((a) => a.exercicioId).filter(Boolean) as string[]);

    await prisma.$transaction(async (tx) => {
      async function herdarVideoParaTemporarioTx(tx: PrismaClient, nome: string) {
        const clean = String(nome || "").trim();
        if (!clean) return null;

        const ex = await (tx as any).exercicio.findFirst({
          where: {
            nome: { equals: clean, mode: "insensitive" },
            NOT: [{ videoDemonstrativoUrl: null }, { videoDemonstrativoUrl: "" }],
          },
          select: { videoDemonstrativoUrl: true },
        });

        return ex?.videoDemonstrativoUrl ? String(ex.videoDemonstrativoUrl) : null;
      }

      await tx.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.exercicioTemporario.deleteMany({ where: { treinoProgramadoId: id } });

      const atualTp = await (tx as any).treinoProgramado.findUnique({
        where: { id },
        select: { professorId: true, criadorProfessorId: true },
      });

      const criadorId: string | null = atualTp?.criadorProfessorId ?? atualTp?.professorId ?? null;

      const colaboradoresEntrada: string[] = Array.isArray((req.body as any)?.colaboradoresProfessorIds)
        ? ((req.body as any).colaboradoresProfessorIds as unknown[])
            .map((v: unknown) => String(v).trim())
            .filter(Boolean)
        : [];

      const uniq = [...new Set(colaboradoresEntrada)].filter((x) => x && x !== criadorId);

      const profs = uniq.length
        ? await (tx as any).professor.findMany({
            where: { OR: [{ id: { in: uniq } }, { usuarioId: { in: uniq } }] },
            select: { id: true },
          })
        : [];

      const colaboradoresFiltrados = profs.map((p: any) => p.id);

      await (tx as any).treinoProgramadoProfessor.deleteMany({
        where: { treinoProgramadoId: id },
      });

      if (colaboradoresFiltrados.length) {
        await (tx as any).treinoProgramadoProfessor.createMany({
          data: colaboradoresFiltrados.map((professorId: string) => ({
            treinoProgramadoId: id,
            professorId,
            papel: "COLABORADOR",
          })),
          skipDuplicates: true,
        });
      }
      
      await tx.treinoProgramado.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(codigo !== undefined ? { codigo } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(nivel !== undefined ? { nivel } : {}),
          ...(categoriasNorm !== undefined ? { categoria: categoriasNorm } : {}),
          ...(tipoTreinoNorm !== undefined ? { tipoTreino: tipoTreinoNorm } : {}),
          ...(dataAgendada !== undefined
            ? {
                dataAgendada: dataAgendada
                  ? (() => {
                      const d = parseDateInput(dataAgendada);
                      if (Number.isNaN(d.getTime())) throw new Error("dataAgendada inválida");
                      return d;
                    })()
                  : null,
              }
            : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(duracao !== undefined ? { duracao: duracao != null ? Number(duracao) : null } : {}),
          ...(dicas !== undefined ? { dicas: Array.isArray(dicas) ? dicas : [] } : {}),
          ...(imagemUrl !== undefined ? { imagemUrl } : {}),
          ...(metas !== undefined ? { metas } : {}),
          ...(pontuacao !== undefined
            ? { pontuacao: pontuacao != null ? Number(pontuacao) : null }
            : {}),
          ...(expiraEm !== undefined
            ? {
                expiraEm: expiraEm
                  ? (() => {
                      const d = parseDateInput(expiraEm);
                      if (Number.isNaN(d.getTime())) throw new Error("expiraEm inválida");
                      return d;
                    })()
                  : null,
              }
            : {}),
      ...(naoExpira !== undefined ? { naoExpira: Boolean(naoExpira) } : {}),
          ...donoUpdate,
        },
      });

      if (exsBanco.length) {
        await tx.treinoProgramadoExercicio.createMany({
          data: exsBanco.map((e, i) => ({
            treinoProgramadoId: id,
            exercicioId: e.exercicioId,
            repeticoes: String(e.repeticoes ?? ""),
            ordem: e.ordem ?? i + 1,
          })),
        });
      }

      if (exsBanco.length) {
        const novosOficiais = exsBanco.map((e) => e.exercicioId).filter(Boolean) as string[];
        const apenasNovos = novosOficiais.filter((exId) => !antigosSet.has(exId));

        if (apenasNovos.length) {
          const professorIdForStats =
            typeof tipoUsuario === "string" && String(tipoUsuario).toLowerCase() === "professor"
              ? String(tipoUsuarioId)
              : undefined;

          await Promise.all(
            apenasNovos.map((exercicioId: string) =>
              onExercicioIncluidoNoTreino({
                treinoId: id,
                exercicioId,
                professorId: professorIdForStats,
              })
            )
          );
        }
      }

      for (const [i, e] of exsTemp.entries()) {
        const nomeTemp = String(e.nome ?? "").trim();
        if (!nomeTemp) continue;

        const videoHerdado = await herdarVideoParaTemporarioTx(tx as any, nomeTemp);

        let temp = await (tx as any).exercicioTemporario.findFirst({
          where: {
            treinoProgramadoId: id,
            nome: { equals: nomeTemp, mode: "insensitive" },
          },
          select: { id: true, videoDemonstrativoUrl: true },
        });

        if (!temp) {
          temp = await (tx as any).exercicioTemporario.create({
            data: {
              treinoProgramadoId: id,
              codigo: null,
              nome: nomeTemp,
              descricao: e.descricao ?? null,
              nivel: nivel !== undefined ? nivel : "Base",
              categorias: categoriasNorm ?? [],
              videoDemonstrativoUrl: videoHerdado ?? null,
            },
            select: { id: true, videoDemonstrativoUrl: true },
          });
        } else if ((!temp.videoDemonstrativoUrl || temp.videoDemonstrativoUrl === "") && videoHerdado) {
          await (tx as any).exercicioTemporario.update({
            where: { id: temp.id },
            data: { videoDemonstrativoUrl: videoHerdado },
          });
        }

        await (tx as any).treinoProgramadoExercicio.create({
          data: {
            treinoProgramadoId: id,
            exercicioTemporarioId: temp.id,
            repeticoes: String(e.repeticoes ?? ""),
            ordem: e.ordem ?? exsBanco.length + i + 1,
          },
        });
      }
    });

    const novosIds = exsBanco.map((e) => e.exercicioId).filter(Boolean) as string[];
    const afetados = new Set<string>([...antigosSet, ...novosIds]);

    for (const exId of afetados) {
      await recomputeInclusoesExercicio(exId);
    }

    const updated = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },

    });
    return res.json(updated);
  } catch (err) {
    console.error("Erro em atualizarTreinoProgramado:", err);
    return res.status(500).json({ message: "Erro ao atualizar treino" });
  }
}

export const deletarTreinoProgramado = async (req: AuthenticatedRequest, res: Response) => {
  const treinoProgramadoIdAlvo = req.params.id;
  const totalAgendadosAtivos = await prisma.treinoAgendado.count({
    where: {
      treinoProgramadoId: treinoProgramadoIdAlvo,
      status: TreinoAgendadoStatus.AGENDADO,
    },
  });

  if (totalAgendadosAtivos > 0) {
    return res.status(409).json({
      message: "Não é possível excluir: há atletas com este treino agendado.",
      totalAgendadosAtivos,
    });
  }

  const { id } = req.params;

  const exRows = await prisma.treinoProgramadoExercicio.findMany({
    where: { treinoProgramadoId: id },
    select: { exercicioId: true },
  });
  const exerciciosAfetados = [...new Set(exRows.map(x => x.exercicioId).filter(Boolean) as string[])];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.treinoAgendado.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.exercicioTemporario.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.treinoProgramado.delete({ where: { id } });
    });
    for (const exId of exerciciosAfetados) {
      await recomputeInclusoesExercicio(exId);
    }

    return res.status(200).json({ message: "Treino excluído." });
  } 
  catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao excluir treino.", error: e.message });
  }
};

export async function validarSubmissaoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { aprovado, pontos } = req.body as { aprovado: boolean; pontos?: number };
    const tipoUsuarioId = String((req.query.tipoUsuarioId ?? "") as string).trim();

    const sub = await prisma.submissaoTreino.findUnique({
      where: { id },
      include: {
        atleta: true,
        treinoAgendado: {
          include: {
            treinoProgramado: {
              select: {
                id: true,
                pontuacao: true,
                nome: true,
                tipoTreino: true,
                duracao: true,
                professorId: true,
                clubeId: true,
                escolinhaId: true,
                professores: { select: { professorId: true } },
              },
            },
          },
        },
      },
    });

    if (!sub) return res.status(404).json({ message: "Submissão não encontrada" });

    const wasApprovedBefore = sub.aprovado === true;

    const resolved = await resolveEntidade(tipoUsuarioId || req.userId!);
    if (!resolved) return res.status(403).json({ message: "Sem permissão" });

    const vinculo = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId: sub.atletaId,
        ...(resolved.tipo === "professor"
          ? { professorId: resolved.id }
          : resolved.tipo === "clube"
          ? { clubeId: resolved.id }
          : { escolinhaId: resolved.id }),
      },
      select: { id: true },
    });

    const tp = sub.treinoAgendado?.treinoProgramado;

    const donoTreino =
    !!tp &&
    (resolved.tipo === "professor"
      ? tp.professorId === resolved.id ||
        (tp.professores?.some((p: { professorId: string }) => p.professorId === resolved.id) ?? false)
      : resolved.tipo === "clube"
      ? tp.clubeId === resolved.id
      : tp.escolinhaId === resolved.id);
      if (!vinculo && !donoTreino) {
        return res
          .status(403)
          .json({ message: "Você não possui vínculo/direito para validar esta submissão." });
      }

    const checklist = (req.body?.checklist ?? null) as {
      templateId: string;
      answers: { itemId: string; value: any; comment?: string }[];
    } | null;

    let pontosDoChecklist: number | null = null;

    if (checklist?.templateId && Array.isArray(checklist.answers)) {
      const existing = await prisma.submissionChecklist.findFirst({
        where: { submissaoTreinoId: sub.id },
      });
      const chk = existing
        ? await prisma.submissionChecklist.update({
            where: { id: existing.id },
            data: { templateId: checklist.templateId },
          })
        : await prisma.submissionChecklist.create({
            data: {
              templateId: checklist.templateId,
              context: "SUBMISSAO_TREINO",
              submissaoTreinoId: sub.id,
            },
          });

      await prisma.checklistAnswer.deleteMany({ where: { checklistId: chk.id } });
      await prisma.checklistAnswer.createMany({
        data: checklist.answers.map((a) => ({
          checklistId: chk.id,
          itemId: a.itemId,
          value: a.value,
          comment: a.comment,
        })),
      });

      const tpl = await prisma.checklistTemplate.findUnique({
        where: { id: checklist.templateId },
        include: { items: true },
      });
      if (tpl) {
        pontosDoChecklist = 0;
        for (const it of tpl.items) {
          const ans = checklist.answers.find((a) => a.itemId === it.id)?.value || {};
          if (it.type === "BOOLEAN") {
            if (ans?.bool === true) pontosDoChecklist += it.weight;
          } else if (it.type === "SCORE") {
            const n = Number(ans?.score ?? 0);
            if (Number.isFinite(n)) pontosDoChecklist += Math.max(0, n) * it.weight;
          } else if (it.type === "SELECT") {
            const v = String(ans?.select || "").toLowerCase();
            if (["aprovada", "aprovado", "ok"].includes(v)) pontosDoChecklist += it.weight;
          }
        }
      }
    }

    const treinoIdForKey = (sub as any).treinoAgendadoId || sub.treinoAgendado?.id || null;
    const usuarioIdDoAtleta = sub.atleta?.usuarioId || null;

    if (treinoIdForKey && usuarioIdDoAtleta) {
      await prisma.treinoUsuario.upsert({
        where: { treinoId_usuarioId: { treinoId: treinoIdForKey, usuarioId: usuarioIdDoAtleta } },
        update: { status: TreinoStatus.COMPLETED, completedAt: new Date() },
        create: {
          treinoId: treinoIdForKey,
          usuarioId: usuarioIdDoAtleta,
          status: TreinoStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    const pontosBase = sub.pontuacaoSnapshot ?? sub.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    const pontosFinais = aprovado
      ? Number.isFinite(Number(pontos))
        ? Number(pontos)
        : pontosDoChecklist ?? pontosBase ?? 0
      : 0;

    const atualizado = await prisma.submissaoTreino.update({
      where: { id: sub.id },
      data: {
        aprovado,
        pontosCreditados: pontosFinais || null,
        pontuacaoSnapshot: pontosFinais || null,
        treinoTituloSnapshot:
          sub.treinoAgendado?.treinoProgramado?.nome ?? sub.treinoAgendado?.titulo ?? undefined,
        tipoTreinoSnapshot: sub.treinoAgendado?.treinoProgramado?.tipoTreino ?? undefined,
        duracaoMinutos: sub.treinoAgendado?.treinoProgramado?.duracao ?? undefined,
        usuarioId: req.userId!,
      },
    });

    if (aprovado === true && !wasApprovedBefore) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(atualizado.id);
      } catch (e) {
        console.warn("stats (feito por aluno) falhou no validarSubmissaoTreino:", e);
      }
    }

    try {
      await recomputePontuacaoAtleta(sub.atletaId);
    } catch (e) {
      console.warn("recomputePontuacaoAtleta falhou (não é crítico para a aprovação):", e);
    }

    // ✅ stats: contar "feito por aluno" quando aprovou agora (e não era aprovado antes)
    if (aprovado === true && !wasApprovedBefore) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
      } catch (e) {
        console.warn("stats (feito por aluno) falhou no validarSubmissaoTreino:", e);
      }
    }

    await audit(req, {
      acao: 'VALIDAR_SUBMISSAO_TREINO',
      entidade: 'SubmissaoTreino',
      entidadeId: atualizado.id,
      descricao: aprovado ? 'Submissão aprovada' : 'Submissão reprovada',
      meta: {
        atletaId: sub.atletaId,
        treinoAgendadoId: sub.treinoAgendadoId,
        pontos: pontosFinais,
        aprovado,
      },
    });

    return res.json({ ok: true, aprovado, pontos: pontosFinais, id: atualizado.id });
  } catch (err) {
    console.error("Erro em validarSubmissaoTreino:", err);
    return res.status(500).json({ message: "Erro ao validar submissão" });
  }
}

export async function listarMinhasSubmissoesTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const qAtletaId = String((req.query.atletaId ?? req.query.tipoUsuarioId ?? "") as string).trim();
    const qUsuarioId = String((req.query.usuarioId ?? "") as string).trim();

    let atletaId = qAtletaId;

    if (!atletaId && qUsuarioId) {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId: qUsuarioId },
        select: { id: true },
      });
      atletaId = atleta?.id ?? "";
    }

    if (!atletaId && req.userId) {
      const u = await prisma.usuario.findUnique({
        where: { id: req.userId },
        include: { atleta: true },
      });
      atletaId = u?.atleta?.id ?? "";
    }

    if (!atletaId) {
      return res.json([]);
    }

    const subs = await prisma.submissaoTreino.findMany({
      where: {
        atletaId,
      },
      include: {
        treinoAgendado: {
          select: {
            id: true,
            treinoProgramadoId: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = subs.map((s) => ({
      id: s.id,
      aprovado: s.aprovado,
      treinoAgendadoId: s.treinoAgendadoId,
      treinoProgramadoId: s.treinoAgendado?.treinoProgramadoId ?? null,
    }));

    return res.json(payload);
  } catch (e) {
    console.error("Erro em listarMinhasSubmissoesTreino:", e);
    return res.status(500).json({ message: "Erro ao buscar submissões do atleta" });
  }
}

export async function statusDesafiosSemanais(req: AuthenticatedRequest, res: Response) {
  try {
    const fromQuery = String((req.query.tipoUsuarioId ?? req.query.atletaId ?? "") as string).trim();

    let atletaId = fromQuery;
    if (!atletaId) {
      const u = await prisma.usuario.findUnique({
        where: { id: req.userId! },
        include: { atleta: { select: { id: true } } },
      });
      atletaId = u?.atleta?.id ?? "";
    }
    if (!atletaId) return res.status(400).json({ error: "tipoUsuarioId (atletaId) é obrigatório" });

    const startOfIsoWeek = (d: Date): Date => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      const day = (x.getDay() + 6) % 7;
      x.setDate(x.getDate() - day);
      return x;
    };

    const w0 = startOfIsoWeek(new Date());
    const windows: { start: Date; end: Date; index: number }[] = Array.from(
      { length: 4 },
      (_, i) => {
        const start = new Date(w0);
        start.setDate(start.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 3);
        return { start, end, index: i + 1 };
      }
    );

    const since = windows[3].start;

    const subs = await prisma.submissaoDesafio.findMany({
      where: {
        atletaId,
        createdAt: { gte: since },
      },
      select: { aprovado: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const weeks = windows.map((w) => {
      const inRange = subs.filter(
        (s: { aprovado: boolean | null; createdAt: Date }) =>
          s.createdAt >= w.start && s.createdAt < w.end
      );
      const approved = inRange.filter((s: { aprovado: boolean | null }) => s.aprovado === true)
        .length;
      const rejected = inRange.filter((s: { aprovado: boolean | null }) => s.aprovado === false)
        .length;

      let status: "success" | "fail" | "none" = "none";
      if (approved > 0) status = "success";
      else if (inRange.length > 0) status = "fail";

      return {
        index: w.index,
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        status,
        count: { total: inRange.length, approved, rejected },
      };
    });

    return res.json({ weeks });
  } catch (e) {
    console.error("statusDesafiosSemanais error:", e);
    return res.status(500).json({ error: "Erro ao montar checker semanal" });
  }
}

export async function listarAgendados(req: Request, res: Response) {
  try {
    const atletaId = String(req.query.atletaId);
    const apenasFuturos = String(req.query.apenasFuturos || "1") === "1";

    if (!atletaId) return res.status(400).json({ message: "atletaId obrigatório" });

    const where: any = { atletaId };
    if (apenasFuturos) where.dataTreino = { gte: startOfDay(new Date()) };

    const itens = await prisma.treinoAgendado.findMany({
      where,
      orderBy: { dataTreino: "asc" },
      include: { treinoProgramado: true },
    });

    res.json(itens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao listar agendados", err });
  }
}

export async function getTreinoStatus(req: AuthenticatedRequest, res: Response) {
  const usuarioId = req.userId!;
  const treinoId = String(req.params.treinoId);
  const tu = await prisma.treinoUsuario.findUnique({
    where: { treinoId_usuarioId: { treinoId, usuarioId } },
    select: { status: true, startedAt: true, completedAt: true },
  });
  res.json(tu ?? { status: "PENDING", startedAt: null, completedAt: null });
}

export async function agendarRotinaMensal(req: AuthenticatedRequest, res: Response) {
  try {
    let user: any = getUserFromReq(req);

    if (!user) {
      const authHeader =
        (req.headers.authorization as string | undefined) ||
        (req.headers.Authorization as string | undefined);

      if (authHeader) {
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : authHeader;

        try {
          user = jwt.verify(token, JWT_SECRET) as any;
          (req as any).user = user;
          (req as any).userId = user.id;
        } catch {
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Usuário não autenticado.",
      });
    }

    const tipoStr = String(user.tipo ?? user.tipoUsuario ?? "").toLowerCase();
    if (!user.plano) {
      user.plano = "FREE";
    }

    if (!["professor", "clube", "escolinha"].includes(tipoStr)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Apenas professor, clube ou escolinha podem agendar rotina mensal.",
      });
    }

    const {
      treinoProgramadoId,
      datas = [],
      atletaIds = [],
      elencosIds = [],
      incluirObservados = false,
    } = req.body as {
      treinoProgramadoId: string;
      datas: string[];
      atletaIds?: string[];
      elencosIds?: string[];
      incluirObservados?: boolean;
    };

    if (!treinoProgramadoId || !Array.isArray(datas) || datas.length === 0) {
      return res
        .status(400)
        .json({ message: "Informe treinoProgramadoId e ao menos uma data." });
    }

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: String(treinoProgramadoId) },
    });
    if (!tp) {
      return res
        .status(404)
        .json({ message: "Treino programado não encontrado." });
    }

    const resolved = await resolveEntidade(req.userId!);

    const atletasDiretos = atletaIds.length
      ? await prisma.atleta.findMany({
          where: { OR: [{ id: { in: atletaIds } }, { usuarioId: { in: atletaIds } }] },
          select: { id: true },
        })
      : [];

    const atletasFromElencos = elencosIds.length
      ? await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencosIds } },
          select: { atletaId: true },
        })
      : [];

    const observados: { id: string }[] =
      incluirObservados && resolved
        ? await prisma.atletaObservado
            .findMany({
              where:
                resolved.tipo === "professor"
                  ? { professorId: resolved.id }
                  : resolved.tipo === "clube"
                  ? { clubeId: resolved.id }
                  : { escolinhaId: resolved.id },
              select: { atletaId: true },
            })
            .then((r) => r.map((x) => ({ id: x.atletaId })))
        : [];

    const atletaIdsFinal = Array.from(
      new Set([
        ...atletasDiretos.map((a) => a.id),
        ...atletasFromElencos.map((a) => a.atletaId),
        ...observados.map((a) => a.id),
      ])
    );

    if (atletaIdsFinal.length === 0) {
      return res
        .status(400)
        .json({ message: "Nenhum atleta resolvido para receber a rotina." });
    }

    let fairUseInfo: {
      exceeded: boolean;
      current: number;
      after: number;
      limit: number;
    } | null = null;

    if (resolved?.tipo === "escolinha" && elencosIds.length) {
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

      const agMes = await prisma.treinoAgendado.count({
        where: {
          atletaId: { in: atletaIdsFinal },
          treinoProgramado: { escolinhaId: resolved.id },
          dataTreino: { gte: inicioMes, lt: fimMes },
        },
      });

      const novos = datas.length * atletaIdsFinal.length;
      const totalDepois = agMes + novos;

      fairUseInfo = {
        exceeded: totalDepois > FAIR_USE_TURMA_MES,
        current: agMes,
        after: totalDepois,
        limit: FAIR_USE_TURMA_MES,
      };
    }

    if (fairUseInfo?.exceeded) {
      return res.status(429).json({
        message: "Limite mensal de agendamentos por turma excedido.",
        fairUse: fairUseInfo,
      });
    }

    const datasParsed = datas
      .map((s) => parseDateOnlySafe(s))
      .filter((d) => !Number.isNaN(d.getTime()));

    if (!datasParsed.length) {
      return res.status(400).json({ message: "Nenhuma data válida em 'datas'." });
    }

    if (user?.plano !== "PRO") {
      const okUso = await requireUsage(req as any, res, "agendamento_rotina_mensal");
      if (!okUso) return;
    }

    const resolvedMe = req.userId ? await resolveEntidade(req.userId) : null;
    const tipoUser = resolvedMe?.tipo ?? String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    const criadoPorProfessorId = tipoUser === "professor" ? (resolvedMe?.id ?? null) : null;

    const toCreate: Array<Prisma.TreinoAgendadoCreateManyInput> = [];

    for (const dt of datasParsed) {
      const dataExpiracao = new Date(dt.getTime() + 3 * 24 * 60 * 60 * 1000);

      for (const atletaId of atletaIdsFinal) {
        toCreate.push({
          titulo: tp.nome ?? "Treino",
          atletaId,
          treinoProgramadoId: tp.id,
          dataTreino: dt,
          dataOriginal: dt,
          dataExpiracao,
          status: TreinoAgendadoStatus.AGENDADO,
          criadoPorProfessorId: criadoPorProfessorId,
        });
      }
    }

    const created = await prisma.treinoAgendado.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    await prisma.estatisticaTreino.upsert({
      where: { treinoId: tp.id },
      create: { treinoId: tp.id, usosProfessores: created.count, feitosAlunos: 0, ultimoUsoEm: new Date() },
      update: { usosProfessores: { increment: created.count }, ultimoUsoEm: new Date() },
    });

    await audit(req as any, {
      acao: "AGENDAR_ROTINA_MENSAL",
      entidade: "TreinoAgendado",
      entidadeId: tp.id,
      descricao: "Rotina mensal agendada",
      meta: {
        treinoProgramadoId: tp.id,
        totalSolicitado: toCreate.length,
        totalCriado: created.count,
        datas: datasParsed.map((d) => d.toISOString().slice(0, 10)),
        atletasCount: atletaIdsFinal.length,
        incluirObservados: Boolean(incluirObservados),
        fairUse: fairUseInfo ?? null,
      },
    });

    return res.status(201).json({
      ok: true,
      treinoProgramadoId: tp.id,
      solicitado: toCreate.length,
      criado: created.count,
      atletas: atletaIdsFinal.length,
      datas: datasParsed.map((d) => d.toISOString().slice(0, 10)),
      fairUse: fairUseInfo,
    });
  } catch (e) {
    console.error("agendarRotinaMensal", e);
    return res.status(500).json({ message: "Erro ao agendar rotina mensal." });
  }
}

export async function expirarTreinosVencidos(req: AuthenticatedRequest, res: Response) {
  try {
    const now = new Date();

    const vencidos = await prisma.treinoAgendado.findMany({
      where: { dataExpiracao: { lt: now } },
      select: {
        id: true,
        atleta: { select: { usuarioId: true } },
      },
    });

    let marcados = 0;

    for (const ag of vencidos) {
      const usuarioId = ag.atleta?.usuarioId;
      if (!usuarioId) continue;

      const tu = await prisma.treinoUsuario.findUnique({
        where: { treinoId_usuarioId: { treinoId: ag.id, usuarioId } },
        select: { status: true },
      });

      if (!tu || tu.status !== TreinoStatus.COMPLETED) {
        await prisma.treinoUsuario.upsert({
          where: { treinoId_usuarioId: { treinoId: ag.id, usuarioId } },
          update: { status: TreinoStatus.EXPIRED },
          create: { treinoId: ag.id, usuarioId, status: TreinoStatus.EXPIRED },
        });
        marcados++;
      }
    }

    return res.json({ ok: true, marcados });
  } catch (e) {
    console.error("expirarTreinosVencidos", e);
    return res.status(500).json({ message: "Erro ao expirar treinos vencidos." });
  }
}

export async function iniciarTreinoAgendado(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;               
    const usuarioId = req.userId!;           
    const atletaId = req.user?.tipoUsuarioId; 

    const tipo = String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    if (!atletaId || tipo !== "atleta") {
      return res.status(403).json({ message: "Apenas atleta pode iniciar o treino." });
    }

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: { atleta: { select: { usuarioId: true } } },
    });

    if (!ag) return res.status(404).json({ message: "Treino agendado não encontrado." });

    if (ag.atletaId !== atletaId || ag.atleta?.usuarioId !== usuarioId) {
      return res.status(403).json({ message: "Não autorizado para iniciar este treino." });
    }

    if (ag.startedAt) {
      const tuExistente = await prisma.treinoUsuario.findUnique({
        where: { treinoId_usuarioId: { treinoId: id, usuarioId } },
      });
      return res.json({
        ok: true,
        treino: ag,
        treinoUsuario: tuExistente,
        startedAt: ag.startedAt,
      });
    }

    const now = new Date();

    const [updated, treinoUsuario] = await prisma.$transaction([
      prisma.treinoAgendado.update({
        where: { id },
        data: { startedAt: now, status: TreinoAgendadoStatus.EM_ANDAMENTO },
      }),
      prisma.treinoUsuario.upsert({
        where: { treinoId_usuarioId: { treinoId: id, usuarioId } },
        create: {
          treinoId: id,
          usuarioId,
          status: TreinoStatus.IN_PROGRESS,
          startedAt: now,
        },
        update: {
          status: TreinoStatus.IN_PROGRESS,
          startedAt: now,
          completedAt: null,
        },
      }),
    ]);

    await audit(req, {
      acao: "ALTERAR_AGENDA",
      entidade: "TreinoAgendado",
      entidadeId: id,
      descricao: "Treino agendado iniciado",
      meta: { atletaId: updated.atletaId, dataTreino: updated.dataTreino, status: "EmAndamento" },
    });

    return res.json({
      ok: true,
      treino: updated,
      treinoUsuario,
      startedAt: treinoUsuario.startedAt,
    });
  } catch (e) {
    console.error("iniciarTreinoAgendado", e);
    return res.status(500).json({ message: "Erro ao iniciar treino agendado." });
  }
}

export async function finalizarTreinoAgendado(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; 
    const usuarioId = req.userId!;
    const atletaId = req.user?.tipoUsuarioId;

    const { observacao, midiaUrl, midiaTipo } = req.body as {
      observacao?: string;
      midiaUrl?: string;
      midiaTipo?: TipoMidia | string;
    };

    let obsSan: string | null = null;
      if (observacao && observacao.trim()) {
        const clean = sanitizeText(observacao, 800);
        const fail = basicModerationFails(clean);
        if (fail) {
          return res.status(422).json({ message: fail });
        }
        obsSan = clean;
      }

      if (req.user?.plano !== "PRO") {
        const ok = await requireUsage(req as any, res, "treinos_semana");
        if (!ok) return;
      }

    const tipo = String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    if (!atletaId || tipo !== "atleta") {
      return res.status(403).json({ message: "Apenas atleta pode iniciar o treino." });
    }

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: { atleta: { select: { usuarioId: true } } },
    });

    if (!ag) return res.status(404).json({ message: "Treino agendado não encontrado." });
    if (ag.atletaId !== atletaId || ag.atleta?.usuarioId !== usuarioId) {
      return res.status(403).json({ message: "Não autorizado." });
    }
    if (!ag.startedAt) {
      return res
        .status(400)
        .json({ message: "Treino ainda não foi iniciado (chame /start antes)." });
    }

    const finishedAt = new Date();
    const duracao = Math.max(
      0,
      Math.floor((finishedAt.getTime() - new Date(ag.startedAt).getTime()) / 1000)
    );

    let midiaEnum: TipoMidia | null = null;
    if (typeof midiaTipo === "string") {
      const s = midiaTipo.toLowerCase();
      if (s.includes("video")) midiaEnum = TipoMidia.Video;
      else if (s.includes("img") || s.includes("foto") || s.includes("image"))
        midiaEnum = TipoMidia.Imagem;
      else if (s.includes("doc")) midiaEnum = TipoMidia.Documento;
    } else if (midiaTipo) {
      midiaEnum = midiaTipo;
    } else if (midiaUrl) {
      midiaEnum = TipoMidia.Video;
    }

    const [updated, treinoUsuario, sub] = await prisma.$transaction([
      prisma.treinoAgendado.update({
        where: { id },
        data: {
          finishedAt,
          duracaoSegundos: duracao,
          status: TreinoAgendadoStatus.CONCLUIDO,
        },
      }),
      prisma.treinoUsuario.upsert({
        where: { treinoId_usuarioId: { treinoId: id, usuarioId } },
        create: {
          treinoId: id,
          usuarioId,
          status: TreinoStatus.COMPLETED,
          startedAt: ag.startedAt ?? finishedAt,
          completedAt: finishedAt,
        },
        update: {
          status: TreinoStatus.COMPLETED,
          completedAt: finishedAt,
        },
      }),
      prisma.submissaoTreino.create({
        data: {
          treinoAgendadoId: id,
          observacao: observacao ?? null,
          midiaUrl: midiaUrl ?? null,
          midiaTipo: midiaEnum,
          duracaoSegundos: duracao,
          atletaId,
        } as any,
      }),
    ]);

    await audit(req, {
      acao: "ALTERAR_AGENDA",
      entidade: "TreinoAgendado",
      entidadeId: id,
      descricao: "Treino agendado finalizado",
      meta: { atletaId: updated.atletaId, dataTreino: updated.dataTreino, status: "Concluido" },
    });

    try {
      await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
          const titulo = updated.titulo ?? "Treino";
          let conteudo = `🏅 Concluí o treino: ${titulo}`;
          if (Number.isFinite(Number(duracao))) conteudo += ` — ${Math.round(Number(duracao))}s`;

          const post = await prisma.postagem.create({
            data: {
              usuarioId,
              conteudo,
              tipoMidia: midiaEnum ?? TipoMidia.Documento,
              imagemUrl: midiaEnum === TipoMidia.Imagem ? (midiaUrl ?? null) : null,
              videoUrl: midiaEnum === TipoMidia.Video ? (midiaUrl ?? null) : null,
            },
            include: {
              usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
              curtidas: true,
              comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
            },
          });

          const segs = await prisma.seguidor.findMany({
            where: { seguidoUsuarioId: usuarioId },
            select: { seguidorUsuarioId: true },
          });

          getIO()
            ?.to([`u:${usuarioId}`, ...segs.map((s) => `u:${s.seguidorUsuarioId}`)])
            .emit("feed:novoPost", post);

          } catch (e) {
            console.warn("onTreinoFeitoPorAlunoFromSubmissao falhou em finalizarTreinoAgendado:", e);
          }

          return res.json({
            ok: true,
            treino: updated,
            treinoUsuario,
            submissao: sub,
          });
        } catch (e) {
          console.error("finalizarTreinoAgendado", e);
          return res.status(500).json({ message: "Erro ao finalizar treino agendado." });
        }
 }

export async function relacaoStatus(req: Request, res: Response) {
  const atletaId = String(req.query.atletaId || "");
  const organizadorId = String(req.query.organizadorId || "");

  if (!atletaId || !organizadorId) {
    return res
      .status(400)
      .json({ error: "atletaId e organizadorId são obrigatórios" });
  }

  try {
    const rel = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId,
        ativo: true,
        OR: [
          { professorId: organizadorId },
          { clubeId: organizadorId },
          { escolinhaId: organizadorId },
        ],
      },
    });

    return res.json({ ativo: !!rel });
  } catch (err) {
    console.error("Erro relacaoStatus:", err);
    return res.status(500).json({ error: "Erro ao consultar status" });
  }
}