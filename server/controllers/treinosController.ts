// server/controllers/treinosController
import {
  PrismaClient,
  PosicaoCampo,
  Categoria,
  TipoTreino,
  TreinoStatus,
  TipoMidia,
  TreinoAgendadoStatus,
  Nivel,
  Prisma
} from "@prisma/client";
import { getIO } from "../socket.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";
import { sanitizeText, basicModerationFails } from "../utils/moderation.js";
import {
  onExercicioIncluidoNoTreino,
  onTreinoFeitoPorAlunoFromSubmissao,
} from "../services/statsService.js";
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
import { startOfMonth, addMonths } from "date-fns";
import { recalcularEstatisticaExercicios } from "server/services/estatisticasExercicio.service.js";
import { prisma } from "../prisma.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";

type Request = ExpressRequest;
type Response = ExpressResponse;

const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || "defaultsecret");

type AuthenticatedRequest = ExpressRequest & {
  userId?: string;
  usuarioId?: string;
  user?: any;
  auth?: any;
};

function getUserId(req: any): string | null {
  // ajuste para o seu middleware:
  // - se você usa authenticateToken e coloca req.user = { id: ... }
  const id =
    req?.user?.id ??
    req?.usuario?.id ??
    req?.auth?.id ??
    req?.userId ??
    req?.usuarioId ??
    null;

  return id ? String(id) : null;
}

async function recomputeFeitosTreino(treinoProgramadoId: string) {
  const rows = await prisma.submissaoTreino.findMany({
    where: {
      treinoAgendado: { is: { treinoProgramadoId } },
    },
    select: {
      treinoAgendadoId: true,
      criadoEm: true,
    },
  });

  const uniq = new Set<string>();
  let ultimo: Date | null = null;

  for (const r of rows) {
    if (!r.treinoAgendadoId) continue;
    uniq.add(r.treinoAgendadoId);
    if (r.criadoEm && (!ultimo || r.criadoEm > ultimo)) {
      ultimo = r.criadoEm;
    }
  }

  const total = uniq.size;

  await prisma.estatisticaTreino.upsert({
    where: { treinoId: treinoProgramadoId },
    create: {
      treinoId: treinoProgramadoId,
      realizacoes: total,
      ultimoRealizadoEm: ultimo ?? null,
    },
    update: {
      realizacoes: total,
      ultimoRealizadoEm: ultimo ?? null,
    },
  });

  return total;
}

function normalizarNomeExercicio(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function deduplicarExerciciosPorNome<T extends { nome?: string; origem?: string | null }>(
  itens: T[]
): T[] {
  const map = new Map<string, T>();

  for (const item of itens) {
    const chave = normalizarNomeExercicio(item.nome ?? "");
    if (!chave) continue;

    const existente = map.get(chave);

    if (!existente) {
      map.set(chave, item);
      continue;
    }

    const atualEhPersonalizado = item.origem === "personalizado";
    const existenteEhPersonalizado = existente.origem === "personalizado";

    // prioridade para exercício oficial
    if (existenteEhPersonalizado && !atualEhPersonalizado) {
      map.set(chave, item);
    }
  }

  return Array.from(map.values());
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

const SAO_PAULO_TZ = "America/Sao_Paulo";
const SAO_PAULO_OFFSET = "-03:00";

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function parseDateInput(raw?: any): Date | null {
  if (!raw) return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO com timezone explícito
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(s)
  ) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // datetime-local sem timezone
  const mLocal = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (mLocal) {
    const [, Y, M, D, h, mi, sec] = mLocal;
    return new Date(
      Number(Y),
      Number(M) - 1,
      Number(D),
      Number(h),
      Number(mi),
      Number(sec || 0),
      0
    );
  }

  // só data
  const mDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) {
    const [, Y, M, D] = mDate;
    return new Date(Number(Y), Number(M) - 1, Number(D), 12, 0, 0, 0);
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateOnlySafe(raw: any): Date {
  const s = String(raw ?? "").trim();
  if (!s) return new Date(NaN);

  const datePart = /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? new Date(NaN) : dt;
}

function startOfDay(d: Date) {
  const { year, month, day } = getSaoPauloDateParts(d);
  return new Date(`${year}-${month}-${day}T00:00:00${SAO_PAULO_OFFSET}`);
}

function endOfDay(d: Date) {
  const start = startOfDay(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
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

export async function realizadosCount(req: AuthenticatedRequest, res: Response) {
  try {
    const treinoId = String(
      req.query.treinoId || req.query.treinoProgramadoId || ""
    ).trim();

    if (!treinoId) {
      return res.json({ realizadoCount: 0 });
    }

    const realizadoCount = await prisma.treinoAgendado.count({
      where: {
        treinoProgramadoId: treinoId,
        status: "CONCLUIDO",
      },
    });

    return res.json({ realizadoCount });
  } catch (e) {
    console.error("[realizados-count]", e);
    return res.json({ realizadoCount: 0 });
  }
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
    if (!novaData) {
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

  syncAgendaAtleta(usuarioId, atletaId);

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
  if (!dt) {
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
      imagemUrl: true,
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

  syncTreinoProgramado(treinoProgramadoId);

  await prisma.estatisticaTreino.upsert({
    where: { treinoId: treinoProgramadoId },
    create: { treinoId: treinoProgramadoId, realizacoes: 0, ultimoRealizadoEm: null },
    update: {},
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

const SESSOES_PADRAO_TREINO = [
  "Aquecimento",
  "Coletivo",
  "Treino de finalização",
];

function normalizarSessaoTreinoNome(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function resolverSessaoTreinoId(sessaoTreino?: any, sessaoTreinoId?: any) {
  const id = String(sessaoTreinoId ?? "").trim();
  if (id) {
    const existe = await prisma.treinoSessao.findUnique({
      where: { id },
      select: { id: true },
    });
    return existe?.id ?? null;
  }

  const nome = String(sessaoTreino ?? "").trim();
  if (!nome) return null;

  return (
    await prisma.treinoSessao.upsert({
      where: { nomeNormalizado: normalizarSessaoTreinoNome(nome) },
      update: { nome },
      create: {
        nome,
        nomeNormalizado: normalizarSessaoTreinoNome(nome),
      },
      select: { id: true },
    })
  ).id;
}

export async function listarSessoesTreino(req: Request, res: Response) {
  try {
    for (const nome of SESSOES_PADRAO_TREINO) {
      await prisma.treinoSessao.upsert({
        where: { nomeNormalizado: normalizarSessaoTreinoNome(nome) },
        update: { nome },
        create: {
          nome,
          nomeNormalizado: normalizarSessaoTreinoNome(nome),
        },
      });
    }

    const items = await prisma.treinoSessao.findMany({
      orderBy: { nome: "asc" },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar sessões de treino.",
      detail: e?.message,
    });
  }
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

    if (!startDate || !endDate) {
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
        dataTreino: { gte: startDate, lt: endDate },
      },
      include: {
        treinoProgramado: {
          include: {
            sessaoTreino: true,
            exercicios: {
              include: {
                exercicio: true,
                exercicioPersonalizado: true,
                exercicioTemporario: true,
              },
            },
          },
        },
      },
      orderBy: { dataTreino: "asc" },
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
      sessaoTreinoId: t.treinoProgramado?.sessaoTreinoId ?? null,
      sessaoTreino: t.treinoProgramado?.sessaoTreino ?? null,
      sessaoTreinoNome: t.treinoProgramado?.sessaoTreino?.nome ?? null,
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

function syncAgendaAtleta(usuarioId: string, atletaId?: string) {
  const io = getIO();
  if (!io || !usuarioId) return;

  io.to(`u:${usuarioId}`).emit("agenda:sync", { usuarioId, atletaId: atletaId ?? null });
  io.to(usuarioId).emit("agenda:sync", { usuarioId, atletaId: atletaId ?? null });
}

function syncTreinoProgramado(treinoProgramadoId: string) {
  const io = getIO();
  if (!io || !treinoProgramadoId) return;

  io.to("treinos:programados").emit("treinos:sync", { treinoProgramadoId });
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

    // ✅ treinos dele (criador) + onde é colaborador
    or.push({ professorId: pid });
    or.push({ professores: { some: { professorId: pid } } });

    // ✅ treinos do clube dele (somente do clube, NÃO dos outros professores)
    const cid = await getClubeIdDoProfessor(pid);
    if (cid) or.push({ clubeId: cid });

    // ✅ treinos da escolinha dele (somente da escolinha, NÃO dos outros professores)
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
      or.push({ professores: { some: { professorId: { in: ctx.professores } } } });
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
        exercicios: { include: { exercicio: true, exercicioPersonalizado: true, exercicioTemporario: true } },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
        sessaoTreino: true,
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
        // 🔑 IDs do criador (usados no front para identificar Clube/Escolinha/Professor)
        clubeId: (t as any).clubeId ?? null,
        escolinhaId: (t as any).escolinhaId ?? null,
        professorId: (t as any).professorId ?? null,
        criadorProfessorId: (t as any).criadorProfessorId ?? null,
        criadores,
        sessaoTreinoId: (t as any).sessaoTreinoId ?? null,
        sessaoTreino: (t as any).sessaoTreino ?? null,
        sessaoTreinoNome: (t as any).sessaoTreino?.nome ?? null,
        tipoTreino: t.tipoTreino ?? null,
        exercicios: t.exercicios.map((e) => {
          const resolved = e.exercicio ?? e.exercicioTemporario ?? e.exercicioPersonalizado ?? null;

          return {
            id: e.id,
            ordem: e.ordem ?? null,
            series: e.series ?? null,
            repeticoes: e.repeticoes ?? "",
            duracao: e.duracao ?? null,
            descanso: e.descanso ?? null,
            descricaoExecucao: e.descricaoExecucao ?? null,
            exercicioId: e.exercicioId ?? null,
            exercicioTemporarioId: e.exercicioTemporarioId ?? null,
            exercicioPersonalizadoId: e.exercicioPersonalizadoId ?? null,
            exercicio: resolved
              ? {
                  tipo: e.exercicio
                    ? "catalogo"
                    : e.exercicioTemporario
                      ? "temporario"
                      : "personalizado",
                  id: resolved.id,
                  codigo: (resolved as any).codigo ?? null,
                  nome: resolved.nome ?? "Exercício",
                  descricao:
                    (resolved as any).descricao ??
                    (resolved as any).objetivo ??
                    null,
                  videoUrl:
                    (resolved as any).videoUrl ??
                    (resolved as any).videoDemonstrativoUrl ??
                    null,
                  videoPosterUrl: (resolved as any).videoPosterUrl ?? null,
                }
              : null,
          };
        }),        
      };
    });

    return res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos disponíveis:", error);
    return res.status(500).json({ message: "Erro ao buscar treinos disponíveis" });
  }
}

// ✅ GET /api/treinos/publicos-professores-parceiros
export async function treinosPublicosProfessoresParceiros(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    // ✅ "parceiro" está em Usuario
    const professoresParceiros = await prisma.professor.findMany({
      where: { usuario: { is: { parceiro: true } } },
      select: { id: true },
    });

    const professorIds = professoresParceiros.map((p) => p.id);
    if (!professorIds.length) return res.json([]);

    // ✅ include tipado corretamente
    const include = {
      exercicios: {
        include: { exercicio: true, exercicioTemporario: true, exercicioPersonalizado: true },
        orderBy: { ordem: "asc" as const },
      },
      professores: {
        include: { professor: { select: { id: true, nome: true } } },
      },
      Professor: { select: { id: true, nome: true } }, // professorId
      criadorProfessor: { select: { id: true, nome: true } }, // criadorProfessorId
      clube: { select: { id: true, nome: true } },
      escolinha: { select: { id: true, nome: true } },
      sessaoTreino: true,
    } satisfies Prisma.TreinoProgramadoInclude;

    const treinos = await prisma.treinoProgramado.findMany({
      where: {
        OR: [
          { criadorProfessorId: { in: professorIds } },
          { professorId: { in: professorIds } },
          { professores: { some: { professorId: { in: professorIds } } } },
        ],
      },
      include,
      orderBy: { createdAt: "desc" },
    });

    const resposta = treinos.map((t) => {
      const criadores: Array<{
        tipo: "Professor" | "Clube" | "Escolinha";
        id: string;
        nome: string;
      }> = [];

      // ✅ criador
      if (t.criadorProfessor) {
        criadores.push({
          tipo: "Professor",
          id: t.criadorProfessor.id,
          nome: t.criadorProfessor.nome,
        });
      }

      // ✅ professor principal (Professor relation de professorId)
      if (t.Professor) {
        const exists = criadores.some(
          (c) => c.tipo === "Professor" && c.id === t.Professor!.id
        );
        if (!exists) {
          criadores.push({
            tipo: "Professor",
            id: t.Professor.id,
            nome: t.Professor.nome,
          });
        }
      }

      // ✅ colaboradores (TreinoProgramadoProfessor[])
      for (const link of t.professores) {
        const prof = link.professor;
        const exists = criadores.some(
          (c) => c.tipo === "Professor" && c.id === prof.id
        );
        if (!exists) {
          criadores.push({ tipo: "Professor", id: prof.id, nome: prof.nome });
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
        // 🔑 IDs do criador (usados no front para identificar Clube/Escolinha/Professor)
        clubeId: (t as any).clubeId ?? null,
        escolinhaId: (t as any).escolinhaId ?? null,
        professorId: (t as any).professorId ?? null,
        criadorProfessorId: (t as any).criadorProfessorId ?? null,
        categoria: t.categoria ?? [],
        tipoTreino: t.tipoTreino ?? null,
        criadores,
        sessaoTreinoId: (t as any).sessaoTreinoId ?? null,
        sessaoTreino: (t as any).sessaoTreino ?? null,
        sessaoTreinoNome: (t as any).sessaoTreino?.nome ?? null,
        exercicios: t.exercicios.map((row: any) => {
          const base = row.exercicio || row.exercicioPersonalizado || row.exercicioTemporario || null;

          return {
            id: String(row.id),
            ordem: row.ordem ?? null,
            repeticoes: row.repeticoes ?? null,
            exercicio: row.exercicio ?? null,
            exercicioPersonalizado: row.exercicioPersonalizado ?? null,
            exercicioTemporario: row.exercicioTemporario ?? null,
            nome: base?.nome ?? null,
            descricao: (base as any)?.descricao ?? (base as any)?.objetivo ?? null,
            videoDemonstrativoUrl: base?.videoDemonstrativoUrl ?? null,
            videoPosterUrl: base?.videoPosterUrl ?? null,
            nivel: base?.nivel ?? null,
          };
        }),
      };
    });

    return res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos públicos (professores parceiros):", error);
    return res.status(500).json({ message: "Erro ao buscar treinos públicos." });
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
        exercicios: {
          select: {
            id: true,
            ordem: true,
            repeticoes: true,
            series: true,
            duracao: true,
            descanso: true,
            descricaoExecucao: true,
            exercicioId: true,
            exercicioPersonalizadoId: true,
            exercicioTemporarioId: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                objetivo: true,
                videoDemonstrativoUrl: true,
                nivel: true,
              },
            },

            exercicioTemporario: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
                nivel: true,
              },
            },

            exercicioPersonalizado: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
                nivel: true,
              },
            },
          },
        },
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
        sessaoTreino: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const treinoIds = rows.map((t) => t.id);
    const subsAll = await prisma.submissaoTreino.groupBy({
      by: ["treinoAgendadoId"],
      where: {
        treinoAgendado: {
          treinoProgramadoId: { in: treinoIds },
        },
      },
      _count: { _all: true },
    });

    const subsApproved = await prisma.submissaoTreino.groupBy({
      by: ["treinoAgendadoId"],
      where: {
        aprovado: true,
        treinoAgendado: {
          treinoProgramadoId: { in: treinoIds },
        },
      },
      _count: { _all: true },
    });

    const agIdsAll = subsAll.map((x) => x.treinoAgendadoId);
    const agIdsAp = subsApproved.map((x) => x.treinoAgendadoId);
    const agMap = await prisma.treinoAgendado.findMany({
      where: { id: { in: Array.from(new Set([...agIdsAll, ...agIdsAp])) } },
      select: { id: true, treinoProgramadoId: true },
    });

    const treinoByAg: Record<string, string> = {};
    for (const a of agMap) treinoByAg[String(a.id)] = String(a.treinoProgramadoId);

    const enviadosMap: Record<string, number> = {};
    for (const row of subsAll) {
      const treinoId = treinoByAg[String(row.treinoAgendadoId)];
      if (!treinoId) continue;
      enviadosMap[treinoId] = (enviadosMap[treinoId] || 0) + (row._count?._all || 0);
    }

    const aprovadosMap: Record<string, number> = {};
    for (const row of subsApproved) {
      const treinoId = treinoByAg[String(row.treinoAgendadoId)];
      if (!treinoId) continue;
      aprovadosMap[treinoId] = (aprovadosMap[treinoId] || 0) + (row._count?._all || 0);
    }

    const statsRows = await prisma.estatisticaTreino.findMany({
      where: { treinoId: { in: treinoIds } },
      select: { treinoId: true, realizacoes: true },
    });

    const feitosMap: Record<string, number> = {};
    for (const s of statsRows) feitosMap[String(s.treinoId)] = Number(s.realizacoes ?? 0);

    const out = rows.map((t) => {
      const criadores: { tipo: string; id: string; nome: string }[] = [];

      if ((t as any).clube) {
        criadores.push({
          tipo: "clube",
          id: (t as any).clube.id,
          nome: (t as any).clube.nome,
        });
      }

      if ((t as any).escolinha) {
        criadores.push({
          tipo: "escolinha",
          id: (t as any).escolinha.id,
          nome: (t as any).escolinha.nome,
        });
      }

      if ((t as any).Professor) {
        criadores.push({
          tipo: "professor",
          id: (t as any).Professor.id,
          nome: (t as any).Professor.nome,
        });
      }

      const clubeId =
        String((t as any).clubeId ?? (t as any).clube?.id ?? "").trim() || null;

      const escolinhaId =
        String((t as any).escolinhaId ?? (t as any).escolinha?.id ?? "").trim() || null;

      const professorId =
        String((t as any).professorId ?? (t as any).Professor?.id ?? "").trim() || null;
      const professoresIds: string[] = Array.from(
            new Set(
              (Array.isArray((t as any).professores) ? (t as any).professores : [])
                .map((p: any) => String(p?.professorId ?? p?.professor?.id ?? p?.id ?? "").trim())
                .filter(Boolean)
            )
          );

      const criadoresNomes = Array.from(
        new Set(
          [
            ...criadores.map((c) => String(c.nome || "").trim()).filter(Boolean),
          ]
        )
      );

      return {
        id: String(t.id),
        nome: String(t.nome ?? ""),
        descricao: t.descricao ?? undefined,
        nivel: String((t as any).nivel ?? ""),
        dataAgendada: (t as any).dataAgendada ?? undefined,
        duracao: typeof (t as any).duracao === "number" ? (t as any).duracao : undefined,
        objetivo: (t as any).objetivo ?? undefined,
        dicas: Array.isArray((t as any).dicas) ? (t as any).dicas : [],
        pontuacao: typeof (t as any).pontuacao === "number" ? (t as any).pontuacao : undefined,
        submissoesEnviadas: enviadosMap[t.id] ?? 0,
        submissoesAprovadas: aprovadosMap[t.id] ?? 0,
        realizacoes: feitosMap[t.id] ?? 0,
        sessaoTreinoId: (t as any).sessaoTreinoId ?? null,
        sessaoTreino: (t as any).sessaoTreino ?? null,
        sessaoTreinoNome: (t as any).sessaoTreino?.nome ?? null,
        // ✅ AQUI É O PONTO: mandar os IDs pro front
        clubeId,
        escolinhaId,
        professorId,
        professoresIds,
        criadores,
        criadoresNomes,
        exercicios: (Array.isArray((t as any).exercicios) ? (t as any).exercicios : []).map((row: any) => {
          const base =
            row.exercicio ||
            row.exercicioPersonalizado ||
            row.exercicioTemporario ||
            null;

          return {
            id: String(row.id),
            ordem: row.ordem ?? null,
            repeticoes: row.repeticoes ?? null,
            // mantém as 3 possibilidades pro front (igual treinos-instrutores/treinos-unicos)
            exercicio: row.exercicio ?? null,
            exercicioPersonalizado: row.exercicioPersonalizado ?? null,
            exercicioTemporario: row.exercicioTemporario ?? null,
            // e ainda manda um "atalho" (opcional) pra facilitar em qualquer tela
            nome: base?.nome ?? null,
            descricao: (base as any)?.descricao ?? (base as any)?.objetivo ?? null,
            videoDemonstrativoUrl: base?.videoDemonstrativoUrl ?? null,
            videoPosterUrl: base?.videoPosterUrl ?? null,
            nivel: base?.nivel ?? null,
          };
        }),
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
            id: true,
            ordem: true,
            repeticoes: true,
            series: true,
            duracao: true,
            descanso: true,
            descricaoExecucao: true,
            exercicioId: true,
            exercicioPersonalizadoId: true,
            exercicioTemporarioId: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                objetivo: true,
                videoDemonstrativoUrl: true,
                nivel: true,
              },
            },

            exercicioTemporario: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
                nivel: true,
              },
            },

            exercicioPersonalizado: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
                nivel: true,
              },
            },
          },
        },

        professores: { include: { professor: { select: { id: true, nome: true } } } },
        Professor: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
        sessaoTreino: true,
      },
    });

    if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

    // ✅ devolve cada row com o "base" completo (catálogo OU temporário OU personalizado)
    const out = {
      ...treino,
      exercicios: (Array.isArray((treino as any).exercicios) ? (treino as any).exercicios : []).map((row: any) => {
        const exBase =
          row.exercicio ||
          row.exercicioPersonalizado ||
          row.exercicioTemporario;

        return {
          id: row.id,
          ordem: row.ordem,
          repeticoes: row.repeticoes ?? null,
          series: row.series ?? null,
          duracao: row.duracao ?? null,
          descanso: row.descanso ?? null,
          descricaoExecucao: row.descricaoExecucao ?? null,
          exercicioId: row.exercicioId ?? null,
          sessaoTreinoId: (treino as any).sessaoTreinoId ?? null,
          sessaoTreino: (treino as any).sessaoTreino ?? null,
          sessaoTreinoNome: (treino as any).sessaoTreino?.nome ?? null,
          exercicioPersonalizadoId: row.exercicioPersonalizadoId ?? null,
          exercicioTemporarioId: row.exercicioTemporarioId ?? null,
          exercicio: exBase
            ? {
                id: exBase.id,
                nome: exBase.nome,
                descricao: (exBase as any).descricao ?? (exBase as any).objetivo ?? null,
                nivel: (exBase as any).nivel ?? null,
                videoDemonstrativoUrl: (exBase as any).videoDemonstrativoUrl ?? null,
              }
            : null,
        };
      }),
    };

    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao buscar treino programado" });
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

    const turmaId = typeof turmaIdRaw === "string" ? turmaIdRaw.trim() : "";
    const elencoId = typeof elencoIdRaw === "string" ? elencoIdRaw.trim() : "";
    const atletaRef = String(atletaIdBody ?? tipoUsuarioId ?? "").trim();

    if (!dataTreino) {
      return res.status(400).json({ message: "Dados incompletos." });
    }

    if (!atletaRef && !turmaId && !elencoId) {
      return res.status(400).json({ message: "Dados incompletos." });
    }

    const atleta = atletaRef
      ? await prisma.atleta.findFirst({
          where: { OR: [{ id: atletaRef }, { usuarioId: atletaRef }] },
          select: { id: true, usuarioId: true },
        })
      : null;

    if (atletaRef && !atleta) {
      return res.status(404).json({ message: "Atleta não encontrado." });
    }

    const atletaId = atleta?.id ?? "";

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: { id: true, nome: true },
    });

    if (!tp) {
      return res.status(404).json({ message: "Treino programado não encontrado." });
    }

    const tituloFinal =
      titulo && String(titulo).trim() ? String(titulo).trim() : tp.nome ?? "Treino";

    const quandoBase = /T/.test(String(dataTreino))
      ? parseDateInput(dataTreino)
      : parseDateOnlySafe(dataTreino);

    if (!quandoBase) {
      return res.status(400).json({ message: "dataTreino inválida" });
    }

    const exp = dataExpiracao
      ? parseDateInput(dataExpiracao)
      : new Date(quandoBase.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (!exp) {
      return res.status(400).json({ message: "dataExpiracao inválida" });
    }

    // ============================
    // ✅ agendar por TURMA (lote)
    // ============================
    if (turmaId && !atletaRef) {
      if (!req.userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const resolved = await resolveEntidade(req.userId);
      if (!resolved) {
        return res.status(403).json({ message: "Sem permissão para agendar para esta turma." });
      }

      const tipoUser =
        resolved.tipo ??
        String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();

      const turmaOwnerOr: Prisma.TurmaWhereInput[] = [];

      // ✅ professor responsável da turma
      if (resolved.tipo === "professor") {
        turmaOwnerOr.push({
          professores: { some: { professorId: resolved.id } },
        });
      }

      // ✅ se for dono institucional
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

      if (!turmaOk) {
        return res.status(403).json({ message: "Sem permissão para agendar para esta turma." });
      }

      const membros = await prisma.turmaUsuario.findMany({
        where: { turmaId },
        select: { usuarioId: true },
      });

      const usuarioIds = membros.map((m) => String(m.usuarioId)).filter(Boolean);

      if (!usuarioIds.length) {
        return res.status(400).json({ message: "Esta turma não possui alunos." });
      }

      const atletas = await prisma.atleta.findMany({
        where: { usuarioId: { in: usuarioIds } },
        select: { id: true, usuarioId: true },
      });

      if (!atletas.length) {
        return res.status(400).json({
          message: "Nenhum atleta encontrado para os usuários da turma.",
        });
      }

      const dayStart = startOfDay(quandoBase);
      const dayEnd = endOfDay(quandoBase);

      const existentes = await prisma.treinoAgendado.findMany({
        where: {
          atletaId: { in: atletas.map((a) => a.id) },
          treinoProgramadoId,
          status: { not: TreinoAgendadoStatus.CONCLUIDO },
          dataTreino: { gte: dayStart, lt: dayEnd },
        },
        select: { atletaId: true },
      });

      const jaTem = new Set(existentes.map((e) => String(e.atletaId)));

      const paraCriar = atletas.filter((a) => !jaTem.has(String(a.id)));

      if (!paraCriar.length) {
        return res.status(409).json({
          message: "Já existe treino agendado para todos os atletas desta turma neste dia.",
          total: atletas.length,
          criados: 0,
          ignorados: atletas.length,
        });
      }

      const criados = await prisma.$transaction(
        paraCriar.map((a) =>
          prisma.treinoAgendado.create({
            data: {
              titulo: tituloFinal,
              atletaId: a.id,
              treinoProgramadoId,
              turmaId, // ✅ IMPORTANTE: salvar a turma no agendamento
              dataTreino: quandoBase,
              dataExpiracao: exp,
              dataOriginal: quandoBase,
              status: TreinoAgendadoStatus.AGENDADO,
              criadoPorProfessorId: tipoUser === "professor" ? resolved.id : null,
            },
          })
        )
      );

      for (const a of paraCriar) {
        if (a.usuarioId) syncAgendaAtleta(a.usuarioId, a.id);
      }

      syncTreinoProgramado(treinoProgramadoId);

      return res.status(201).json({
        message: "Treino agendado para a turma com sucesso!",
        total: atletas.length,
        criados: criados.length,
        ignorados: atletas.length - criados.length,
        turmaId,
        treinoProgramadoId,
        dataTreino: quandoBase,
      });
    }

    if (!atleta) {
      return res
        .status(400)
        .json({ message: "atletaId é obrigatório (quando não for turma/elenco)." });
    }

    const resolvedMe = req.userId ? await resolveEntidade(req.userId) : null;
    const tipoUser =
      resolvedMe?.tipo ??
      String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();

    if (["professor", "clube", "escolinha"].includes(tipoUser)) {
      const resolved = req.userId ? await resolveEntidade(req.userId) : null;

      if (resolved) {
        let temVinc = false;

        if (resolved.tipo === "professor") {
          temVinc = !!(await prisma.relacaoTreinamento.findFirst({
            where: {
              atletaId,
              professorId: resolved.id,
              NOT: { ativo: false },
            },
            select: { id: true },
          }));
        }

        if (resolved.tipo === "clube") {
          temVinc = !!(await prisma.atleta.findFirst({
            where: {
              id: atletaId,
              OR: [
                { clubeId: resolved.id },
                {
                  relacoesTreinamento: {
                    some: {
                      clubeId: resolved.id,
                      NOT: { ativo: false },
                    },
                  },
                },
              ],
            },
            select: { id: true },
          }));
        }

        if (resolved.tipo === "escolinha") {
          temVinc = !!(await prisma.atleta.findFirst({
            where: {
              id: atletaId,
              OR: [
                { escolinhaId: resolved.id },
                {
                  relacoesTreinamento: {
                    some: {
                      escolinhaId: resolved.id,
                      NOT: { ativo: false },
                    },
                  },
                },
              ],
            },
            select: { id: true },
          }));
        }

        const ehObservado = await prisma.atletaObservado.findFirst({
          where: {
            atletaId,
            ...(resolved.tipo === "professor"
              ? { professorId: resolved.id }
              : resolved.tipo === "clube"
              ? { clubeId: resolved.id }
              : { escolinhaId: resolved.id }),
          },
          select: { id: true },
        });

        const vinculoDireto =
          (resolved.tipo === "clube" &&
            (await prisma.atleta.findUnique({
              where: { id: atletaId },
              select: { clubeId: true },
            }))?.clubeId === resolved.id) ||
          (resolved.tipo === "escolinha" &&
            (await prisma.atleta.findUnique({
              where: { id: atletaId },
              select: { escolinhaId: true },
            }))?.escolinhaId === resolved.id);

        if (!temVinc && !ehObservado && !vinculoDireto) {
          if (turmaId) {
            const membro = await prisma.turmaUsuario.findFirst({
              where: { turmaId, usuarioId: atleta.usuarioId ?? "__none__" },
              select: { id: true },
            });

            const turmaOwnerOr: Prisma.TurmaWhereInput[] = [];
            if (resolved.tipo === "professor") {
              turmaOwnerOr.push({
                professores: { some: { professorId: resolved.id } },
              });
            }
            if (resolved.tipo === "clube") turmaOwnerOr.push({ clubeId: resolved.id });
            if (resolved.tipo === "escolinha") turmaOwnerOr.push({ escolinhaId: resolved.id });

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
            return res
              .status(403)
              .json({ message: "Você não possui vínculo nem observação com este atleta." });
          }
        }
      }
    }

    const dayStart = startOfDay(quandoBase);
    const dayEnd = endOfDay(quandoBase);

    const existenteMesmoDia = await prisma.treinoAgendado.findFirst({
      where: {
        atletaId,
        treinoProgramadoId,
        status: { not: TreinoAgendadoStatus.CONCLUIDO },
        dataTreino: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });

    if (existenteMesmoDia) {
      return res.status(409).json({
        message: "Já existe um treino agendado para este atleta neste dia.",
        treinoAgendadoId: existenteMesmoDia.id,
      });
    }

    const criado = await prisma.treinoAgendado.create({
      data: {
        titulo: tituloFinal,
        atletaId,
        treinoProgramadoId,
        turmaId: turmaId || null, // ✅ IMPORTANTE: se veio turma, salva também
        dataTreino: quandoBase,
        dataExpiracao: exp,
        dataOriginal: quandoBase,
        status: TreinoAgendadoStatus.AGENDADO,
        criadoPorProfessorId: tipoUser === "professor" ? resolvedMe?.id ?? null : null,
      },
    });

    syncAgendaAtleta(atleta.usuarioId!, atletaId);
    syncTreinoProgramado(treinoProgramadoId);

    if (treinoProgramadoId) {
      await prisma.estatisticaTreino.upsert({
        where: { treinoId: treinoProgramadoId },
        create: { treinoId: treinoProgramadoId, realizacoes: 0, ultimoRealizadoEm: null },
        update: { ultimoRealizadoEm: new Date() },
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

    if (ag.atletaId && ag.atleta?.usuarioId) {
      syncAgendaAtleta(ag.atleta.usuarioId, ag.atletaId);
    }
    syncTreinoProgramado(String(ag.treinoProgramadoId ?? ""));

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

  if (!atleta) {
    return {
      atletaId: null,
      clubes: [],
      escolinhas: [],
      professores: [] as string[],
    };
  }

  const rels = await client.relacaoTreinamento.findMany({
    where: {
      atletaId: atleta.id,
      NOT: { ativo: false },
    },
    select: { clubeId: true, escolinhaId: true, professorId: true },
  });

  const clubesDiretos = new Set<string>();
  const escolinhasDiretas = new Set<string>();
  const professoresDiretos = new Set<string>();

  if (atleta.clubeId) clubesDiretos.add(atleta.clubeId);
  if (atleta.escolinhaId) escolinhasDiretas.add(atleta.escolinhaId);

  for (const r of rels) {
    if (r.clubeId) clubesDiretos.add(r.clubeId);
    if (r.escolinhaId) escolinhasDiretas.add(r.escolinhaId);
    if (r.professorId) professoresDiretos.add(r.professorId);
  }

  const clubesViaProfessor = new Set<string>();
  const escolinhasViaProfessor = new Set<string>();
  const profArr = [...professoresDiretos];

  if (profArr.length) {
    const [pRows, linksClube, linksEscola] = await Promise.all([
      client.professor.findMany({
        where: { id: { in: profArr } },
        select: { id: true, clubeId: true, escolinhaId: true },
      }),
      client.professorClube.findMany({
        where: { professorId: { in: profArr } },
        select: { clubeId: true },
      }),
      client.professorEscolinha.findMany({
        where: { professorId: { in: profArr } },
        select: { escolinhaId: true },
      }),
    ]);

    for (const p of pRows) {
      if (p.clubeId) clubesViaProfessor.add(p.clubeId);
      if (p.escolinhaId) escolinhasViaProfessor.add(p.escolinhaId);
    }
    for (const l of linksClube) if (l.clubeId) clubesViaProfessor.add(l.clubeId);
    for (const l of linksEscola) if (l.escolinhaId) escolinhasViaProfessor.add(l.escolinhaId);
  }

  const professores = new Set<string>(professoresDiretos);
  const clubesDiretosArr = [...clubesDiretos];
  const escolasDiretasArr = [...escolinhasDiretas];

  if (clubesDiretosArr.length) {
    const profsDoClube = await Promise.all(clubesDiretosArr.map((cid) => getProfessorIdsDoClube(cid)));
    for (const pid of profsDoClube.flat()) professores.add(pid);
  }

  if (escolasDiretasArr.length) {
    const profsDaEscolinha = await Promise.all(escolasDiretasArr.map((eid) => getProfessorIdsDaEscolinha(eid)));
    for (const pid of profsDaEscolinha.flat()) professores.add(pid);
  }

  const clubes = new Set<string>([...clubesDiretos, ...clubesViaProfessor]);
  const escolinhas = new Set<string>([...escolinhasDiretas, ...escolinhasViaProfessor]);

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

    const aprovadas = await prisma.submissaoTreino.groupBy({
      by: ["treinoAgendadoId"],
      where: {
        // ✅ “submetido” = existe submissão (não depende de aprovado)
        treinoAgendado: { treinoProgramadoId: { in: ids } },
      },
      _count: { _all: true },
    });

    const agIds = aprovadas.map((x) => x.treinoAgendadoId);
    const agMap = await prisma.treinoAgendado.findMany({
      where: { id: { in: agIds } },
      select: { id: true, treinoProgramadoId: true },
    });

    const treinoByAg: Record<string, string> = {};
    for (const a of agMap) treinoByAg[String(a.id)] = String(a.treinoProgramadoId);

    const realizadoCountByTreinoId: Record<string, number> = {};

    for (const row of aprovadas) {
      const ag = await prisma.treinoAgendado.findUnique({
        where: { id: row.treinoAgendadoId },
        select: { treinoProgramadoId: true },
      });

      const treinoId = String(ag?.treinoProgramadoId ?? "");
      if (!treinoId) continue;

      realizadoCountByTreinoId[treinoId] =
        (realizadoCountByTreinoId[treinoId] || 0) + 1;
    }

    const treinos = await prisma.treinoProgramado.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        exercicios: { select: { id: true } },
      },
    });

    const exerciciosCountByTreinoId: Record<string, number> = {};
    for (const t of treinos) {
      exerciciosCountByTreinoId[String(t.id)] = Array.isArray(t.exercicios) ? t.exercicios.length : 0;
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

    const turmaId =
      typeof req.query.turmaId === "string" ? req.query.turmaId.trim() : "";

    const ownerTipoRaw =
      typeof req.query.ownerTipo === "string" ? req.query.ownerTipo.trim() : "";

    const ownerId =
      typeof req.query.ownerId === "string" ? req.query.ownerId.trim() : "";

    const ownerTipo = ownerTipoRaw.toLowerCase();

    const monthRaw =
      typeof req.query.month === "string" ? req.query.month.trim() : "";

    // month esperado: "YYYY-MM"
    const monthStart = (() => {
      if (!monthRaw) return startOfMonth(new Date());
      const m = monthRaw.match(/^(\d{4})-(\d{2})$/);
      if (!m) return startOfMonth(new Date());
      const y = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return startOfMonth(new Date());
      return new Date(y, mm - 1, 1, 0, 0, 0, 0);
    })();

    const inicioMes = startOfMonth(monthStart);
    const inicioProximoMes = addMonths(inicioMes, 1);

    const apenasFuturos = String(req.query.apenasFuturos || "") === "1";
    const apenasComSubmissao = String(req.query.apenasComSubmissao || "") === "1";
    const agora = new Date();
    
    if (turmaId) {
      const resolved = await resolveEntidade(req.userId);
      if (!resolved) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      const turmaOwnerOr: Prisma.TurmaWhereInput[] = [];

      // acesso normal
      if (resolved.tipo === "professor") {
        turmaOwnerOr.push({
          professores: { some: { professorId: resolved.id } },
        });
      }
      if (resolved.tipo === "clube") {
        turmaOwnerOr.push({ clubeId: resolved.id });
      }
      if (resolved.tipo === "escolinha") {
        turmaOwnerOr.push({ escolinhaId: resolved.id });
      }

      // ✅ modo gestor: professor gerindo clube/escolinha
      if (resolved.tipo === "professor" && ownerId && ownerTipo) {
        if (ownerTipo === "clube") {
          turmaOwnerOr.push({ clubeId: ownerId });
        }
        if (ownerTipo === "escolinha") {
          turmaOwnerOr.push({ escolinhaId: ownerId });
        }
      }

      const turmaOk = await prisma.turma.findFirst({
        where: {
          id: turmaId,
          ...(turmaOwnerOr.length ? { OR: turmaOwnerOr } : {}),
        },
        select: { id: true, nome: true, clubeId: true, escolinhaId: true },
      });

      if (!turmaOk) {
        return res.status(403).json({ error: "Você não tem acesso a esta turma." });
      }

      // 2) buscar SOMENTE os treinos agendados para essa turma
      const rows = await prisma.treinoAgendado.findMany({
        where: {
          turmaId: turmaId, // ✅ ESSA É A PRINCIPAL CORREÇÃO
          dataTreino: { gte: inicioMes, lt: inicioProximoMes },
        },
        include: {
          atleta: {
            select: {
              id: true,
              usuarioId: true,
              usuario: {
                select: { nome: true, foto: true },
              },
            },
          },
          treinoProgramado: {
            select: {
              id: true,
              nome: true,
              nivel: true,
              imagemUrl: true,
              categoria: true,
              tipoTreino: true,
              dataAgendada: true,
              sessaoTreino: true,
              sessaoTreinoId: true,
              criadorProfessor: { include: { usuario: true } },
              Professor: { include: { usuario: true } },
              clube: true,
              escolinha: true,
              professores: {
                include: { professor: { include: { usuario: true } } },
              },
              exercicios: {
                include: {
                  exercicio: true,
                  exercicioPersonalizado: true,
                  exercicioTemporario: true,
                },
                orderBy: { ordem: "asc" as const },
              },
            },
          },
          submissaoTreinos: {
            select: {
              id: true,
              aprovado: true,
              atletaId: true,
              treinoAgendadoId: true,
            },
          },
        },
        orderBy: { dataTreino: "asc" },
      });

      if (!rows.length) return res.json([]);

      // 3) agrupar por treino + dia + horário + turma
      const grupos = new Map<string, typeof rows>();

      for (const r of rows) {
      const dt = r.dataTreino ? new Date(r.dataTreino) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;

      const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(dt);

      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";

        const y = get("year");
        const m = get("month");
        const d = get("day");
        const hh = get("hour");
        const mm = get("minute");

        const treinoKey = String(
          r.treinoProgramadoId ??
          r.treinoProgramado?.id ??
          r.titulo ??
          r.id
        );

        const key = `${turmaId}__${y}-${m}-${d}__${hh}:${mm}__${treinoKey}`;

        const atual = grupos.get(key) ?? [];
        atual.push(r);
        grupos.set(key, atual);
      }

      const agora = new Date();

      const resultado = Array.from(grupos.values()).map((items) => {
        const base = items[0];
        const dataTreino = base.dataTreino ? new Date(base.dataTreino) : null;
        const totalAgendados = items.length;
        const totalAprovados = items.reduce((acc, item) => {
          const aprovou = item.submissaoTreinos?.some((s) => s.aprovado === true);
          return acc + (aprovou ? 1 : 0);
        }, 0);

        const totalEnviados = items.reduce((acc, item) => {
          return acc + (item.submissaoTreinos?.length ?? 0);
        }, 0);

        const maioriaConcluiu = totalAprovados >= Math.ceil(totalAgendados / 2);

        let statusTurma: "CONCLUIDO" | "PENDENTE" | "PERDIDO" = "PENDENTE";

        if (maioriaConcluiu) {
          statusTurma = "CONCLUIDO";
        } else if (dataTreino) {
          const limite = new Date(dataTreino.getTime() + 60 * 60 * 1000); // +1h
          if (agora > limite) {
            statusTurma = "PERDIDO";
          }
        }

        return {
          id: `${base.id}__grupo`,
          titulo:
            base.treinoProgramado?.nome ??
            base.titulo ??
            "Treino",
          treinoProgramadoId:
            base.treinoProgramadoId ??
            base.treinoProgramado?.id ??
            null,
          treinoProgramado: base.treinoProgramado ?? null,
          sessaoTreinoId: base.treinoProgramado?.sessaoTreinoId ?? null,
          sessaoTreino: base.treinoProgramado?.sessaoTreino ?? null,
          sessaoTreinoNome: base.treinoProgramado?.sessaoTreino?.nome ?? null,
          dataTreino: base.dataTreino ? new Date(base.dataTreino).toISOString() : null,
          dataExpiracao: base.dataExpiracao ? new Date(base.dataExpiracao).toISOString() : null,
          dataOriginal: base.dataOriginal ? new Date(base.dataOriginal).toISOString() : null,
          turmaId: turmaId,
          turmaNome: turmaOk.nome ?? null,
          alunosCount: totalAgendados,
          submissao: {
            enviados: totalEnviados,
            aprovados: totalAprovados,
            feito: totalAprovados > 0,
            maioriaConcluiu,
            totalAgendados,
          },
          meuStatus: statusTurma,
          status: statusTurma,
          execucaoStatus: statusTurma,
          atleta: null, // ✅ agenda da turma não é por aluno individual
        };
      });

      let filtrado = resultado;

      if (apenasFuturos) {
        const hoje = startOfDay(new Date());
        filtrado = filtrado.filter((r: any) => {
          if (!r.dataTreino) return true;
          const dt = new Date(r.dataTreino);
          if (Number.isNaN(dt.getTime())) return true;
          return dt >= hoje;
        });
      }

      if (apenasComSubmissao) {
        filtrado = filtrado.filter((r: any) => (r.submissao?.enviados ?? 0) > 0);
      }

      return res.json(filtrado);
    }

    // =========================================================
    // ✅ MODO ATLETA (comportamento atual), só corrigindo "month"
    // =========================================================
    const atletaIdQuery =
      typeof req.query.atletaId === "string" ? req.query.atletaId.trim() : "";

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
      if (!atletaUsuarioIdGuess) return res.status(400).json({ error: "usuarioId ausente" });

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
      vinc.professores.length ? { professores: { some: { professorId: { in: vinc.professores } } } } : undefined,
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
            exercicios: { include: { exercicio: true, exercicioPersonalizado: true, exercicioTemporario: true } },
            professores: { include: { professor: { select: { id: true, nome: true } } } },
            Professor: { select: { id: true, nome: true } },
            clube: { select: { id: true, nome: true } },
            escolinha: { select: { id: true, nome: true } },
            sessaoTreino: true,
          },
        },
      },
      orderBy: { dataTreino: "asc" },
    });

    const agIds = rows.map((r) => r.id);

    const tuRows = await prisma.treinoUsuario.findMany({
      where: { treinoId: { in: agIds }, usuarioId: req.userId! },
      select: { treinoId: true, status: true, startedAt: true, completedAt: true },
    });
    const tuMap = new Map(tuRows.map((r) => [r.treinoId, r]));

    const subRows = await prisma.submissaoTreino.findMany({
      where: { treinoAgendadoId: { in: agIds }, atletaId },
      select: { treinoAgendadoId: true, aprovado: true },
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
      if (sub.aprovados > 0) meu = TreinoStatus.COMPLETED;
      else if (tu?.status && tu.status !== TreinoStatus.COMPLETED) meu = tu.status;
      else if (r.dataExpiracao && r.dataExpiracao < agora) meu = TreinoStatus.EXPIRED;

      return {
        ...r,
        dataTreino: r.dataTreino ? new Date(r.dataTreino).toISOString() : null,
        dataExpiracao: r.dataExpiracao ? new Date(r.dataExpiracao).toISOString() : null,
        dataOriginal: r.dataOriginal ? new Date(r.dataOriginal).toISOString() : null,
        meuStatus: meu,
        startedAt: tu?.startedAt ?? null,
        completedAt: tu?.completedAt ?? null,
        sessaoTreinoId: r.treinoProgramado?.sessaoTreinoId ?? null,
        sessaoTreino: r.treinoProgramado?.sessaoTreino ?? null,
        sessaoTreinoNome: r.treinoProgramado?.sessaoTreino?.nome ?? null,
        treinoProgramado: r.treinoProgramado
          ? {
              ...r.treinoProgramado,
              sessaoTreinoId: r.treinoProgramado.sessaoTreinoId ?? null,
              sessaoTreino: r.treinoProgramado.sessaoTreino ?? null,
              sessaoTreinoNome: r.treinoProgramado.sessaoTreino?.nome ?? null,
            }
          : null,
        submissao: { enviados: sub.enviados, aprovados: sub.aprovados, feito: sub.aprovados > 0 },
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

    if (aprovadoAgora && !jaAprovadaAntes && agendado.treinoProgramadoId) {
      try {
        await recomputeFeitosTreino(String(agendado.treinoProgramadoId));
      } catch (e) {
        console.warn("recomputeFeitosTreino falhou em concluirTreino:", e);
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

    await prisma.treinoAgendado.update({
      where: { id: treinoAgendadoId },
      data: { status: TreinoAgendadoStatus.CONCLUIDO },
    });

    syncAgendaAtleta(usuarioId, atletaId);
    if (agendado.treinoProgramadoId) syncTreinoProgramado(String(agendado.treinoProgramadoId));

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

export async function getExercicios(req: AuthenticatedRequest, res: Response) {
  try {
    const exercicios = await prisma.exercicio.findMany({
      where: {
        AND: [{ criadoPorId: null }],
      },
      orderBy: [{ nome: "asc" }],
      select: {
        id: true,
        nome: true,
        objetivo: true,
        nivel: true,
        faixaEtaria: true,
        videoDemonstrativoUrl: true,
        criadoPorId: true,

        // ✅ campos que precisam ir para o NovoTreino
        series: true,
        repeticoes: true,
        duracao: true,
        descanso: true,
      },
    });

    const out = deduplicarExerciciosPorNome(
      exercicios.map((e) => ({
        ...e,
        origem: "catalogo" as const,
      }))
    );

    return res.json(out);
  } catch (err) {
    console.error("Erro ao buscar exercícios:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMeusExercicios(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const [exerciciosBancoDoUsuario, exerciciosPersonalizadosDoUsuario] =
      await Promise.all([
        prisma.exercicio.findMany({
          where: {
            criadoPorId: userId,
          },
          orderBy: [{ nome: "asc" }],
        }),

        prisma.exercicioPersonalizado.findMany({
          where: {
            criadorUsuarioId: userId,
          },
          orderBy: [
            { atualizadoEm: "desc" },
            { nome: "asc" },
          ],
          take: 500,
        }),
      ]);

    const itens = [
      ...exerciciosBancoDoUsuario.map((x) => ({
        id: String(x.id),
        origem: "exercicio" as const,
        nome: x.nome ?? "Exercício",
        objetivo: (x as any).objetivo ?? null,
        descricao: (x as any).descricao ?? null,
        nivel: (x as any).nivel ?? null,
        categorias: Array.isArray((x as any).categoria)
          ? (x as any).categoria
          : Array.isArray((x as any).categorias)
          ? (x as any).categorias
          : [],
        videoDemonstrativoUrl:
          (x as any).videoDemonstrativoUrl ??
          (x as any).videoUrl ??
          null,
        videoPosterUrl: (x as any).videoPosterUrl ?? null,
        // ✅ adicionar
        series: (x as any).series ?? null,
        repeticoes: (x as any).repeticoes ?? null,
        duracao: (x as any).duracao ?? null,
        descanso: (x as any).descanso ?? null,
      })),

      ...exerciciosPersonalizadosDoUsuario.map((x) => ({
        id: String(x.id),
        origem: "personalizado" as const,
        nome: x.nome ?? "Exercício",
        objetivo: (x as any).objetivo ?? null,
        descricao: (x as any).descricao ?? null,
        nivel: (x as any).nivel ?? null,
        categorias: Array.isArray((x as any).categorias)
          ? (x as any).categorias
          : Array.isArray((x as any).categoria)
          ? (x as any).categoria
          : [],
        videoDemonstrativoUrl: (x as any).videoDemonstrativoUrl ?? null,
        videoPosterUrl: (x as any).videoPosterUrl ?? null,
      })),
    ];

    const personalizadosMapeados = exerciciosPersonalizadosDoUsuario.map((p) => ({
      id: String(p.id),
      nome: p.nome ?? "Exercício",
      codigo: (p as any).codigo ?? null,
      descricao: (p as any).descricao ?? null,
      objetivo: null,
      nivel: (p as any).nivel ?? null,
      categorias: Array.isArray((p as any).categorias)
        ? (p as any).categorias
        : [],
      videoDemonstrativoUrl:
        (p as any).videoDemonstrativoUrl ??
        (p as any).videoUrl ??
        null,
      videoPosterUrl: (p as any).videoPosterUrl ?? null,
      criadoPorId: (p as any).criadorUsuarioId ?? null,
      series: (p as any).series ?? null,
      repeticoes: (p as any).repeticoes ?? null,
      duracao: (p as any).duracao ?? null,
      descanso: (p as any).descanso ?? null,
      origem: "personalizado" as const,
      exercicioPersonalizadoId: String(p.id),
    }));

    const oficiais = await prisma.exercicio.findMany({
      select: {
        id: true,
        nome: true,
        nomeNormalizado: true,
      },
    });

    const nomesOficiais = new Set(
      oficiais
        .map((e) => e.nomeNormalizado || normalizarNomeExercicio(e.nome))
        .filter(Boolean)
    );

    const personalizadosSemCatalogo = personalizadosMapeados.filter((p: any) => {
      const nomeNorm = normalizarNomeExercicio(p.nome);
      return nomeNorm && !nomesOficiais.has(nomeNorm);
    });

    return res.json(
      personalizadosSemCatalogo.map((p: any) => ({
        ...p,
        origem: "personalizado",
        exercicioId: null,
        exercicioPersonalizadoId: String(p.exercicioPersonalizadoId ?? p.id),
      }))
    );
  } catch (error) {
    console.error("Erro ao listar meus exercícios:", error);
    return res.status(500).json({ message: "Erro ao listar meus exercícios." });
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

  let at: { usuarioId: string | null } | null = null;

  if (row.atletaId) {
    at = await prisma.atleta.findUnique({
      where: { id: row.atletaId },
      select: { usuarioId: true },
    });
  }

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

    const [prof, clube, escola] = await Promise.all([
      prisma.professor.findFirst({
        where: { OR: [{ id: tipoUsuarioId }, { usuarioId: tipoUsuarioId }] },
        select: { id: true },
      }),
      prisma.clube.findFirst({
        where: { OR: [{ id: tipoUsuarioId }, { usuarioId: tipoUsuarioId }] },
        select: { id: true },
      }),
      prisma.escolinha.findFirst({
        where: { OR: [{ id: tipoUsuarioId }, { usuarioId: tipoUsuarioId }] },
        select: { id: true },
      }),
    ]);

    const professorIdResolved = prof?.id ?? null;
    const clubeIdResolved = clube?.id ?? null;
    const escolinhaIdResolved = escola?.id ?? null;
    const anyId = tipoUsuarioId;
    const whereBase: Prisma.AtletaWhereInput = {
      OR: [
        ...(professorIdResolved
          ? [
              {
                relacoesTreinamento: {
                  some: {
                    professorId: professorIdResolved,
                    NOT: { ativo: false },
                  },
                },
              },
            ]
          : [
              {
                relacoesTreinamento: {
                  some: {
                    professorId: anyId,
                    NOT: { ativo: false },
                  },
                },
              },
            ]),

        ...(clubeIdResolved
          ? [
              {
                relacoesTreinamento: {
                  some: {
                    clubeId: clubeIdResolved,
                    NOT: { ativo: false },
                  },
                },
              },
              { clubeId: clubeIdResolved },
            ]
          : [
              {
                relacoesTreinamento: {
                  some: {
                    clubeId: anyId,
                    NOT: { ativo: false },
                  },
                },
              },
              { clubeId: anyId },
            ]),

         ...(escolinhaIdResolved
          ? [
              {
                relacoesTreinamento: {
                  some: {
                    escolinhaId: escolinhaIdResolved,
                    NOT: { ativo: false },
                  },
                },
              },
              { escolinhaId: escolinhaIdResolved },
            ]
          : [
              {
                relacoesTreinamento: {
                  some: {
                    escolinhaId: anyId,
                    NOT: { ativo: false },
                  },
                },
              },
              { escolinhaId: anyId },
            ]),
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

  const restaurados = [];

  for (const nomeRaw of nomes) {
    const nome = String(nomeRaw || "").trim();
    if (!nome) continue;

    const existente = await prisma.treinoProgramado.findFirst({
      where: {
        nome: { equals: nome, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existente) {
      const atualizado = await prisma.treinoProgramado.update({
        where: { id: existente.id },
        data: {
          naoExpira: true,
          dataAgendada: null,
        },
      });

      restaurados.push(atualizado);
      continue;
    }

    const criado = await prisma.treinoProgramado.create({
      data: {
        nome,
        codigo: `${nome}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nivel: Nivel.Base,
        tipoTreino: TipoTreino.Fisico,
        categoria: [],
        duracao: 60,
        pontuacao: 15,
        dicas: [],
        naoExpira: true,
        dataAgendada: null,
      },
    });

    restaurados.push(criado);
  }

  return res.json({ ok: true, restaurados: restaurados.length });
}

export async function criarTreinoProgramado(
  req: AuthenticatedRequest,
  res: Response
) {
  let userCtx: any = getUserFromReq(req);

  // ✅ Suporta multipart com formData.append("payload", JSON.stringify(...))
  const rawPayload = (req.body as any)?.payload;
  if (rawPayload && typeof rawPayload === "string") {
    try {
      const parsed = JSON.parse(rawPayload);
      req.body = { ...(req.body as any), ...parsed };
    } catch (e) {
      return res.status(400).json({ message: "Payload inválido (JSON)." });
    }
  }

  if (!userCtx) {
    const authHeader =
      (req.headers.authorization as string | undefined) ||
      (req.headers.Authorization as string | undefined);

    if (authHeader) {
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      try {
        userCtx = jwt.verify(token, JWT_SECRET) as any;
        (req as any).userCtx = userCtx;
        (req as any).userId = userCtx.id;
      } catch (e) {
        console.error("[criarTreinoProgramado] Erro ao decodificar JWT:", e);
      }
    }
  }

  if (!userCtx) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Usuário não autenticado.",
    });
  }

  const tipoStr = String(userCtx.tipo ?? userCtx.tipoUsuario ?? "").toLowerCase();
  if (!userCtx.plano) userCtx.plano = "FREE";
  userCtx.plano = String(userCtx.plano ?? "FREE").trim().toUpperCase();

  const isOrganizador =
    tipoStr === "professor" || tipoStr === "clube" || tipoStr === "escolinha";

  if (!can(userCtx, CAP_CRIAR_TREINO) && !isOrganizador) {
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "Seu plano não permite criar novos treinos programados.",
    });
  }

  try {
    const {
      nome,
      descricao,
      nivel,
      exercicios,
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
      imagemUrl,
      parceiro,
      sessaoTreino,
      sessaoTreinoId,
    } = req.body as any;

    const tokenUser =
      (req as any).user as { tipo?: string; tipoUsuarioId?: string } | undefined;

  const tipoNormHeaderBody = String(
    tokenUser?.tipo ||
      (req.headers["x-tipo"] as string) ||
      tipoUsuario ||
      ""
  )
    .toLowerCase()
    .trim();

  // ✅ fonte de verdade: token (tipoStr). header/body só como fallback
  const tipoNorm = (tipoStr || tipoNormHeaderBody).toLowerCase().trim();

    const tipoUsuarioIdFinal = String(
      tokenUser?.tipoUsuarioId ||
        (req.headers["x-tipousuarioid"] as string) ||
        tipoUsuarioId ||
        ""
    ).trim();

    if (!(Object.values(Nivel) as string[]).includes(String(nivel))) {
      return res.status(400).json({ message: "Nivel inválido" });
    }
    const nivelEnum = nivel as Nivel;

    const usuarioIdToken =
      (req as any).userId ||
      (req as any).user?.id ||
      (req as any).user?.usuarioId ||
      "";

    // ✅ fonte de verdade do parceiro: Usuario.parceiro
    const usuarioDb = await prisma.usuario.findUnique({
      where: { id: String(usuarioIdToken) },
      select: { parceiro: true },
    });

    const usuarioEhParceiro = Boolean(usuarioDb?.parceiro);
    const bypassLimitesTreinoParceiro = tipoStr === "professor" && usuarioEhParceiro;    // ✅ parceiro pode criar ilimitado (apenas professor)
    const parceiroSolicitado = Boolean(parceiro);

    if (parceiroSolicitado && !usuarioEhParceiro) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Apenas usuários parceiros podem publicar treinos como parceiros.",
      });
    }

    // ✅ só professor pode criar treino parceiro (se você quiser essa regra)
    const parceiroFinal =
      tipoNorm === "professor" ? parceiroSolicitado : false;


    if (
      !nome ||
      !nivel ||
      !Array.isArray(exercicios) ||
      !tipoUsuarioIdFinal ||
      !usuarioIdToken
    ) {
      console.warn("[criarTreinoProgramado] Dados inválidos:", {
        nome,
        nivel,
        exerciciosEhArray: Array.isArray(exercicios),
        tipoUsuarioIdFinal,
        usuarioIdToken,
      });
      return res.status(400).json({ error: "Dados inválidos" });
    }

    let categorias: Categoria[] = [];
    const catRaw = req.body?.categoria;

    // ✅ categoria opcional
    const categoriaVazia =
      catRaw == null ||
      catRaw === "" ||
      (Array.isArray(catRaw) && catRaw.length === 0);

    if (!categoriaVazia) {
      try {
        categorias = normalizeCategorias(catRaw);
      } catch {
        return res.status(400).json({
          error: "Categoria(s) inválida(s)",
          recebida: catRaw,
        });
      }
    }

    let tipoTreinoNorm: TipoTreino | undefined = undefined;
    if (tipoTreino !== undefined) {
      tipoTreinoNorm = normalizeTipoTreino(tipoTreino);
      if (!tipoTreinoNorm && tipoTreino !== null) {
        return res.status(400).json({ message: "TipoTreino inválido" });
      }
    }

    const when = dataTreino || dataAgendada || null;

    const pontuacaoNum = Number.isFinite(Number(pontuacao))
      ? Math.max(0, Math.floor(Number(pontuacao)))
      : null;

    // limites (professor)
    if (
      tipoStr === "professor" &&
      !bypassLimitesTreinoParceiro &&
      !can(userCtx, FEAT.TREINOS_ILIMITADOS)
    ) {
      const profId = String(tipoUsuarioIdFinal);
      const ativos = await prisma.treinoProgramado.count({
        where: {
          NOT: [{ naoExpira: true }],
          OR: [
            { Professor: { is: { id: profId } } },
            { professores: { some: { professorId: profId } } },
          ],
        },
      });

      const limAtivos = planLimitFor(
        userCtx.plano ?? "FREE",
        "planos_ativos_total"
      );

      if (ativos >= limAtivos) {
        return res.status(402).json({
          code: "UPGRADE_REQUIRED",
          message:
            "Você atingiu o limite de planos/rotinas ativos para o seu plano.",
        });
      }
    }

    if (
      tipoStr === "professor" &&
      !bypassLimitesTreinoParceiro &&
      !can(userCtx, FEAT.ROTINAS_ILIMITADAS)
    ) {
      const profId = String(tipoUsuarioIdFinal);
      const templates = await prisma.treinoProgramado.count({
        where: { naoExpira: true, Professor: { is: { id: profId } } },
      });

      const limTpl = planLimitFor(userCtx.plano ?? "FREE", "templates_total");
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

    const body = req.body as any;

    // ✅ se for professor, tipoUsuarioIdFinal pode vir como usuarioId
    let professorIdToConnect: string | null = null;

    // ✅ resolve o professor ANTES do limite (pra ownerWhere funcionar)
    if (tipoNorm === "professor") {
      const prof = await prisma.professor.findFirst({
        where: {
          OR: [{ id: tipoUsuarioIdFinal }, { usuarioId: tipoUsuarioIdFinal }],
        },
        select: { id: true },
      });

      if (!prof?.id) {
        return res.status(400).json({
          code: "PROFESSOR_NOT_FOUND",
          message:
            "Não encontrei o professor do usuário logado (tipoUsuarioId inválido).",
          recebida: tipoUsuarioIdFinal,
        });
      }

      professorIdToConnect = prof.id;
    }

    // ✅ swap de slot: se já tem 5, obriga escolher um pra apagar
    const apagarTreinoProgramadoId = String(
      (req.body as any)?.apagarTreinoProgramadoId || ""
    ).trim();

    const plan = String(
      (req.user as any)?.plano || (req.user as any)?.plan || "FREE"
    ).trim().toUpperCase();

    const limit = planLimitFor(plan, "treinos_programados_mes"); // 5 no FREE

    // ✅ parceiro professor não entra em limite
    if (!bypassLimitesTreinoParceiro && Number.isFinite(limit)) {
      // monta o "owner" correto (e evita professorIdToConnect null)
      const ownerWhere =
        tipoNorm === "clube"
          ? { clubeId: String(tipoUsuarioIdFinal) }
          : tipoNorm === "escolinha" || tipoNorm === "escola"
          ? { escolinhaId: String(tipoUsuarioIdFinal) }
          : tipoNorm === "professor"
          ? (professorIdToConnect
              ? {
                  OR: [
                    { criadorProfessorId: professorIdToConnect },
                    { professorId: professorIdToConnect },
                  ],
                }
              : null)
          : null;

      if (ownerWhere) {
        const result = await prisma.$transaction(async (tx) => {
          // se veio id pra apagar, apaga (garantindo ownership)
          if (apagarTreinoProgramadoId) {
            await tx.treinoProgramado.deleteMany({
              where: {
                id: apagarTreinoProgramadoId,
                ...ownerWhere,
              },
            });
          }

          const used = await tx.treinoProgramado.count({ where: ownerWhere });

          if (used >= Number(limit)) {
            const meus = await tx.treinoProgramado.findMany({
              where: ownerWhere,
              select: { id: true, nome: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 20,
            });

            return { allowed: false as const, used, meus };
          }

          return { allowed: true as const };
        });

        if (!result.allowed) {
          return res.status(400).json({
            code: "LIMIT_TREINOS_PROGRAMADOS",
            message: `Você já possui ${Number(limit)} treinos. Escolha um para apagar e liberar espaço.`,
            meus: result.meus,
          });
        }
      }
    }

    if (tipoNorm === "professor") {
      const prof = await prisma.professor.findFirst({
        where: {
          OR: [
            { id: tipoUsuarioIdFinal },
            { usuarioId: tipoUsuarioIdFinal },
          ],
        },
        select: { id: true },
      });

      if (!prof?.id) {
        return res.status(400).json({
          code: "PROFESSOR_NOT_FOUND",
          message:
            "Não encontrei o professor do usuário logado (tipoUsuarioId inválido).",
          recebida: tipoUsuarioIdFinal,
        });
      }

      professorIdToConnect = prof.id;
    }

    // ✅ criadorProfessor deve ser o id REAL do professor
    const professorCriadorId =
      tipoStr === "professor" ? (professorIdToConnect ?? "") : "";
    // colaboradores
    const colaboradoresEntradaRaw =
      body.colaboradoresProfessorIds ??
      body.professoresIds ??
      body.colaboradoresIds ??
      body.criadoresIds ??
      [];

    const colaboradoresEntrada: string[] = Array.isArray(colaboradoresEntradaRaw)
      ? (colaboradoresEntradaRaw as unknown[])
          .map((v: unknown) => String(v).trim())
          .filter(Boolean)
      : typeof colaboradoresEntradaRaw === "string"
      ? colaboradoresEntradaRaw
          .split(",")
          .map((v: string) => v.trim())
          .filter(Boolean)
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

      if (profs.length !== colaboradoresEntradaUniq.length) {
        return res.status(400).json({
          message:
            "Um ou mais colaboradores são inválidos (não encontrei professor por id/usuarioId).",
          recebidos: colaboradoresEntradaUniq,
          encontrados: colaboradoresProfessorIds,
        });
      }
    }

    // ✅ bloqueia nome duplicado ANTES de criar (case-insensitive)
    const nomeFinal = String(nome || "").trim();

    const whereMesmoDono =
      tipoNorm === "professor"
        ? {
            OR: [
              { professorId: professorIdToConnect! },
              { criadorProfessorId: professorIdToConnect! },
            ],
          }
        : tipoNorm === "clube"
        ? { clubeId: String(tipoUsuarioIdFinal) }
        : tipoNorm === "escolinha"
        ? { escolinhaId: String(tipoUsuarioIdFinal) }
        : tipoNorm === "admin"
        ? { criadorUsuarioId: String(tipoUsuarioIdFinal) }
        : {};

    const jaExisteNome = await prisma.treinoProgramado.findFirst({
      where: {
        nome: { equals: nomeFinal, mode: "insensitive" },
        ...whereMesmoDono,
      },
      select: { id: true, nome: true },
    });

    if (jaExisteNome) {
      return res.status(409).json({
        code: "TREINO_NOME_DUPLICADO_DO_MESMO_DONO",
        message:
          "Esse treino não pode ser criado porque você já possui um treino com esse nome. Se quiser criar, mude o nome do treino.",
        treinoExistenteId: jaExisteNome.id,
        treinoExistenteNome: jaExisteNome.nome,
      });
    }

    const objetivoFinal =
      (typeof (body as any).objetivo === "string" && (body as any).objetivo.trim()) ||
      (typeof (body as any).metas === "string" && (body as any).metas.trim()) ||
      null;

    const sessaoTreinoIdFinal = await resolverSessaoTreinoId(
      sessaoTreino,
      sessaoTreinoId
    );

    const treino = await prisma.treinoProgramado.create({
      data: {
        codigo: typeof body.codigo === "string" ? body.codigo.trim() : undefined,
        nome: nomeFinal,
        descricao: descricao ?? null,
        nivel: nivelEnum,
        tipoTreino: tipoTreinoNorm ?? null,
        categoria: categorias,
        dicas: Array.isArray(dicas) ? dicas : [],
        duracao: duracao != null ? Number(duracao) : null,
        objetivo: objetivoFinal,
        dataAgendada: whenDate,
        pontuacao: pontuacaoNum,
        imagemUrl: imagemUrl || null,
        parceiro: parceiroFinal,
        sessaoTreinoId: sessaoTreinoIdFinal,
        ...(tipoNorm === "professor"
          ? { professorId: professorIdToConnect! }
          : {}),
        ...(tipoNorm === "clube"
          ? { clubeId: String(tipoUsuarioIdFinal) }
          : {}),
        ...(tipoNorm === "escolinha"
          ? { escolinhaId: String(tipoUsuarioIdFinal) }
          : {}),
        ...(professorCriadorId
          ? { criadorProfessorId: professorCriadorId }
          : {}),
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
        professores: {
          include: { professor: { select: { id: true, nome: true } } },
        },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
    });

    // ✅ Vincular treino em 1+ metodologias (se vier do front)
    const metodologiaIdsRaw = (req.body as any)?.metodologiaIds;
    const metodologiaIds: string[] = Array.isArray(metodologiaIdsRaw)
      ? metodologiaIdsRaw.map((x: any) => String(x).trim()).filter(Boolean)
      : [];

    if (metodologiaIds.length) {
      // só pode vincular em metodologias criadas pelo próprio usuário
      const userId = String(usuarioIdToken);

      const metas = await prisma.metodologia.findMany({
        where: { id: { in: metodologiaIds }, criadorUsuarioId: userId },
        select: { id: true },
      });

      if (metas.length !== metodologiaIds.length) {
        return res.status(403).json({
          code: "FORBIDDEN",
          message: "Você só pode vincular treinos às metodologias que você criou.",
          recebidas: metodologiaIds,
          permitidas: metas.map((m) => m.id),
        });
      }

      await prisma.metodologiaTreino.createMany({
        data: metodologiaIds.map((metodologiaId) => ({
          metodologiaId,
          treinoProgramadoId: treino.id,
        })),
        skipDuplicates: true,
      });
    }

    const exItems: any[] = Array.isArray(exercicios) ? exercicios : [];

    const exsOficiais = exItems.filter((e) => {
      const id = String(e?.exercicioId ?? "").trim();
      return !!id;
    });

    const exsTemporarios = exItems.filter((e) => {
      const id = String(e?.exercicioId ?? "").trim();
      const nomeTemp = String(e?.nome ?? "").trim();
      return !id && !!nomeTemp;
    });

    if (!exsOficiais.length && !exsTemporarios.length) {
      return res.status(400).json({
        message: "Adicione pelo menos 1 exercício (catálogo ou personalizado).",
      });
    }
    // match simples no BD
    
    const promoverParaBancoSeBater = async (tx: any, nomeTemp: string) => {
      const nomeNorm = nomeTemp.trim();
      const achado = await tx.exercicio.findFirst({
        where: {
          OR: [
            { nome: { equals: nomeNorm, mode: "insensitive" } },
            { nome: { contains: nomeNorm, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      return achado?.id ?? null;
    };

    await prisma.$transaction(async (tx) => {
      // 1) oficiais (createMany)
      if (exsOficiais.length) {
        for (let idx = 0; idx < exsOficiais.length; idx++) {
          const e = exsOficiais[idx];
          const exercicioId = String(e.exercicioId).trim();

          const repeticoesFinal = String(
            e.repeticoes ?? e.repeticoesStr ?? e.reps ?? ""
          ).trim();

          const seriesFinal =
            Number.isFinite(Number(e.series)) && Number(e.series) > 0
              ? Number(e.series)
              : null;

          const duracaoFinal =
            e.duracao != null && String(e.duracao).trim() !== ""
              ? String(e.duracao).trim()
              : null;

          const descansoFinal =
            e.descanso != null && String(e.descanso).trim() !== ""
              ? String(e.descanso).trim()
              : null;
          const descricaoSalvar =
            typeof e?.descricao === "string" && e.descricao.trim()
              ? e.descricao.trim()
              : typeof e?.observacao === "string" && e.observacao.trim()
              ? e.observacao.trim()
              : typeof e?.descricaoExecucao === "string" && e.descricaoExecucao.trim()
              ? e.descricaoExecucao.trim()
              : null;

          // 1. atualiza descrição na origem, se existir
          if (e.exercicioId && typeof e.descricao === "string" && e.descricao.trim()) {
            await tx.exercicio.update({
              where: { id: String(e.exercicioId) },
              data: {
                objetivo: descricaoSalvar,
              },
            });
          }

          if (
            e.exercicioPersonalizadoId &&
            typeof e.descricao === "string" &&
            e.descricao.trim()
          ) {
            await tx.exercicioPersonalizado.update({
              where: { id: String(e.exercicioPersonalizadoId) },
              data: {
                descricao:
                  typeof e.descricao === "string" && e.descricao.trim()
                    ? e.descricao.trim()
                    : null,
              },
            });
          }

          if (
            e.exercicioTemporarioId &&
            typeof e.descricao === "string" &&
            e.descricao.trim()
          ) {
            await tx.exercicioTemporario.update({
              where: { id: String(e.exercicioTemporarioId) },
              data: {
                descricao:
                  typeof e.descricao === "string" && e.descricao.trim()
                    ? e.descricao.trim()
                    : null,
              },
            });
          }
              
          // 2. cria o vínculo no treino
          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: treino.id,
              exercicioId,
              ordem: Number.isFinite(Number(e.ordem)) ? Number(e.ordem) : idx + 1,
              repeticoes: repeticoesFinal,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              descricaoExecucao: descricaoSalvar,
            },
          });

          await tx.exercicio.update({
            where: { id: exercicioId },
            data: {
              repeticoes: repeticoesFinal || null,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              objetivo: descricaoSalvar,
            },
          });
        }
      }

      // 2) personalizados (reutilizáveis)
      for (let i = 0; i < exsTemporarios.length; i++) {
        const e = exsTemporarios[i];
        const nomeTemp = String(e?.nome ?? "").trim();
        if (!nomeTemp) continue;

        // Sempre verifica catálogo pelo nome antes de criar personalizado
        const exercicioBancoId = await promoverParaBancoSeBater(tx, nomeTemp);

        if (exercicioBancoId) {
          const repeticoesFinal = String(e.repeticoes ?? e.repeticoesStr ?? e.reps ?? "").trim();
          const seriesFinal =
            Number.isFinite(Number(e.series)) && Number(e.series) > 0
              ? Number(e.series)
              : null;
          const duracaoFinal =
            e.duracao != null && String(e.duracao).trim() !== ""
              ? String(e.duracao).trim()
              : null;
          const descansoFinal =
            e.descanso != null && String(e.descanso).trim() !== ""
              ? String(e.descanso).trim()
              : null;

          const descricaoSalvar =
            typeof e.descricao === "string" && e.descricao.trim()
              ? e.descricao.trim()
              : typeof e.observacao === "string" && e.observacao.trim()
              ? e.observacao.trim()
              : typeof e.descricaoExecucao === "string" && e.descricaoExecucao.trim()
              ? e.descricaoExecucao.trim()
              : null;

          if (exercicioBancoId && typeof e.descricao === "string" && e.descricao.trim()) {
            await tx.exercicio.update({
              where: { id: String(exercicioBancoId) },
              data: {
                objetivo: descricaoSalvar,
              },
            });
          }

          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: treino.id,
              exercicioId: exercicioBancoId,
              ordem: Number.isFinite(Number(e.ordem))
                ? Number(e.ordem)
                : exsOficiais.length + i + 1,
              repeticoes: repeticoesFinal,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              descricaoExecucao: descricaoSalvar,
            },
          });

          // ✅ atualiza também a tabela Exercicio
          await tx.exercicio.update({
            where: { id: exercicioBancoId },
            data: {
              repeticoes: repeticoesFinal || null,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              objetivo: descricaoSalvar,
            },
          });

          continue;
        }

        const criadorUsuarioId = String(usuarioIdToken);
        const videoHerdado = await herdarVideoParaTemporario(nomeTemp);
        const descricaoFinal =
          (typeof e.descricao === "string" && e.descricao.trim())
            ? e.descricao.trim()
            : (typeof e.exercicioPersonalizado?.descricao === "string" && e.exercicioPersonalizado.descricao.trim())
              ? e.exercicioPersonalizado.descricao.trim()
              : null;
        // 1) Se veio exercicioPersonalizadoId, busca por ID diretamente
        const providedEpId = String(e.exercicioPersonalizadoId ?? "").trim();
        let pers: { id: string; videoDemonstrativoUrl: string | null; videoPosterUrl: string | null } | null = null;

        if (providedEpId) {
          pers = await tx.exercicioPersonalizado.findUnique({
            where: { id: providedEpId },
            select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
          });
        }

        // 2) Fallback: busca por criador + nome
        if (!pers) {
          pers = await tx.exercicioPersonalizado.findFirst({
            where: {
              criadorUsuarioId,
              nome: { equals: nomeTemp, mode: "insensitive" },
            },
            select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
          });
        }

        // 3) Se não existe, cria novo personalizado
        if (!pers) {
          pers = await tx.exercicioPersonalizado.create({
            data: {
              criadorUsuarioId,
              nome: nomeTemp,
              descricao: descricaoFinal,
              nivel: nivelEnum,
              categorias: categorias ?? [],
              videoPosterUrl: e.videoPosterUrl ?? null,
              videoDemonstrativoUrl:
                e.videoDemonstrativoUrl ?? e.videoUrl ?? videoHerdado ?? null,
            },
            select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
          });
        }

        // ✅ 3) “narrow” pro TS parar de reclamar de null
        if (!pers) throw new Error("Falha ao criar ExercicioPersonalizado.");

        if (
          typeof e.descricao === "string" &&
          e.descricao.trim() &&
          pers
        ) {
          await tx.exercicioPersonalizado.update({
            where: { id: pers.id },
            data: {
              descricao: e.descricao.trim(),
            },
          });
        }
        // ✅ 4) atualiza vídeo se estava vazio e agora veio
        const novoVideo = e.videoDemonstrativoUrl ?? e.videoUrl ?? videoHerdado ?? null;
        if ((!pers.videoDemonstrativoUrl || pers.videoDemonstrativoUrl === "") && novoVideo) {
          await tx.exercicioPersonalizado.update({
            where: { id: pers.id },
            data: { videoDemonstrativoUrl: novoVideo },
          });
        }

        const novoPoster = e.videoPosterUrl ?? null;
        if ((!pers.videoPosterUrl || pers.videoPosterUrl === "") && novoPoster) {
          await tx.exercicioPersonalizado.update({
            where: { id: pers.id },
            data: { videoPosterUrl: novoPoster },
          });
        }

        const descricaoSalvar =
          typeof e.descricao === "string" && e.descricao.trim()
            ? e.descricao.trim()
            : typeof e.observacao === "string" && e.observacao.trim()
            ? e.observacao.trim()
            : typeof e.descricaoExecucao === "string" && e.descricaoExecucao.trim()
            ? e.descricaoExecucao.trim()
            : null;

        // ✅ 5) linka no treino usando exercicioPersonalizadoId
        await tx.treinoProgramadoExercicio.create({
          data: {
            treinoProgramadoId: treino.id,
            exercicioPersonalizadoId: pers.id,
            ordem: Number.isFinite(Number(e.ordem))
              ? Number(e.ordem)
              : exsOficiais.length + i + 1,
            series:
              Number.isFinite(Number(e.series)) && Number(e.series) > 0
                ? Number(e.series)
                : null,
            duracao:
              e.duracao != null && String(e.duracao).trim() !== ""
                ? String(e.duracao).trim()
                : null,
            descanso:
              e.descanso != null && String(e.descanso).trim() !== ""
                ? String(e.descanso).trim()
                : null,
            descricaoExecucao: descricaoSalvar, 
            repeticoes: String(e.repeticoes ?? e.repeticoesStr ?? e.reps ?? "1"),
          },
        });
      }
    });

    await syncTreinoProgramado(treino.id);

    // recalcular estatísticas
    try {
      const rowsIncluidos = await prisma.treinoProgramadoExercicio.findMany({
        where: {
          treinoProgramadoId: treino.id,
          exercicioId: { not: null },
        },
        select: { exercicioId: true },
      });

      const exercicioIdsIncluidos = Array.from(
        new Set(rowsIncluidos.map((r) => r.exercicioId!).filter(Boolean))
      );

      if (exercicioIdsIncluidos.length) {
        await recalcularEstatisticaExercicios(exercicioIdsIncluidos);
      }
    } catch (e) {
      console.warn(
        "[criarTreinoProgramado] Falha ao recalcular estatísticas de exercícios:",
        e
      );
    }

    // atletas via elencos
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
        const whenDateAg = treino.dataAgendada ?? new Date();
        const dataExpiracao = new Date(
          whenDateAg.getTime() + 3 * 24 * 60 * 60 * 1000
        );

        await prisma.treinoAgendado.createMany({
          data: atletaIdsResolved.map((atletaId) => ({
            titulo: treino.nome,
            atletaId,
            treinoProgramadoId: treino.id,
            dataTreino: whenDateAg,
            dataExpiracao,
            dataOriginal: whenDateAg,
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
    // ✅ Prisma Unique Constraint
    if (err?.code === "P2002") {
      const target = err?.meta?.target;
      const fields = Array.isArray(target) ? target : [target].filter(Boolean);

      if (fields.includes("nome")) {
        return res.status(409).json({
          code: "NOME_JA_UTILIZADO",
          message:
            "Esse nome já está sendo utilizado. Troque o título do treino e tente novamente.",
        });
      }

      if (fields.includes("codigo")) {
        return res.status(409).json({
          code: "CODIGO_JA_UTILIZADO",
          message:
            "Esse código já está sendo utilizado. Gere outro e tente novamente.",
        });
      }

      return res.status(409).json({
        code: "DUPLICADO",
        message: "Já existe um treino com dados únicos repetidos (nome/código).",
      });
    }

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
  let body: any = req.body;

  // ✅ Suporta multipart com formData.append("payload", JSON.stringify(...))
  const rawPayload = body?.payload;
  if (rawPayload && typeof rawPayload === "string") {
    try {
      const parsed = JSON.parse(rawPayload);
      body = { ...body, ...parsed }; // ✅ usa body atualizado, não só req.body
    } catch {
      return res.status(400).json({ message: "Payload inválido (JSON)." });
    }
  }

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
      sessaoTreino,
      sessaoTreinoId,
    } = body as any;

    if (nome || codigo) {
      const OR: any[] = [];
      if (nome) {
        OR.push({
          nome: { equals: String(nome).trim(), mode: "insensitive" },
        });
      }
      if (codigo) {
        OR.push({ codigo: String(codigo).trim() });
      }

      const mesmoDono =
        String(tipoUsuario || "").toLowerCase() === "professor"
          ? {
              OR: [
                { professorId: String(tipoUsuarioId) },
                { criadorProfessorId: String(tipoUsuarioId) },
              ],
            }
          : String(tipoUsuario || "").toLowerCase() === "clube"
          ? { clubeId: String(tipoUsuarioId) }
          : String(tipoUsuario || "").toLowerCase() === "escolinha" ||
            String(tipoUsuario || "").toLowerCase() === "escola"
          ? { escolinhaId: String(tipoUsuarioId) }
          : String(tipoUsuario || "").toLowerCase() === "admin"
          ? { criadorUsuarioId: String(tipoUsuarioId) }
          : {};

      const dup = await prisma.treinoProgramado.findFirst({
        where: {
          id: { not: id },
          ...mesmoDono,
          OR,
        },
        select: { id: true, nome: true, codigo: true },
      });

      if (dup) {
        return res.status(400).json({
          message: "Já existe treino com esse nome ou código para este mesmo dono.",
          duplicado: dup,
        });
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

    const criadorProfessorId = (body as any)?.criadorProfessorId ?? (body as any)?.professorId ?? null;

    if ((!tipoUsuario || !tipoUsuarioId) && criadorProfessorId) {
      donoUpdate.professorId = String(criadorProfessorId);
      donoUpdate.clubeId = null;
      donoUpdate.escolinhaId = null;
    }

    if (tipoUsuario || tipoUsuarioId) {
      const s = String(tipoUsuario || "").toLowerCase();
      donoUpdate.professorId = null;
      donoUpdate.clubeId = null;
      donoUpdate.escolinhaId = null;

      if (s === "professor") donoUpdate.professorId = String(tipoUsuarioId);
      if (s === "clube") donoUpdate.clubeId = String(tipoUsuarioId);
      if (s === "escolinha" || s === "escola") donoUpdate.escolinhaId = String(tipoUsuarioId);
    }

    const exs: any[] = Array.isArray(exercicios) ? exercicios : [];
    const exsBanco = exs.filter((e) => e.exercicioId);

    const antigos = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId: id },
      select: { exercicioId: true },
    });
    const antigosSet = new Set(antigos.map((a) => a.exercicioId).filter(Boolean) as string[]);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      async function herdarVideoParaTemporarioTx(tx: Prisma.TransactionClient, nome: string) {
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

      const atualTp = await (tx as any).treinoProgramado.findUnique({
        where: { id },
        select: { professorId: true, criadoPorProfessorId: true },
      });

      const criadorId: string | null = atualTp?.criadoPorProfessorId ?? atualTp?.professorId ?? null;

      const colabRaw =
        (body as any)?.colaboradoresProfessorIds ??
        (body as any)?.professoresColabIds ??
        (body as any)?.professoresIds ??
        (body as any)?.colaboradoresIds ??
        [];

      const colaboradoresEntrada: string[] = Array.isArray(colabRaw)
        ? (colabRaw as unknown[]).map((v) => String(v).trim()).filter(Boolean)
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
      
      const sessaoTreinoIdFinal =
        sessaoTreino !== undefined || sessaoTreinoId !== undefined
          ? await resolverSessaoTreinoId(sessaoTreino, sessaoTreinoId)
          : undefined;

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
                      if (!d) throw new Error("dataAgendada inválida");
                      return d;
                    })()
                  : null,
              }
            : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(sessaoTreinoIdFinal !== undefined
              ? { sessaoTreinoId: sessaoTreinoIdFinal }
              : {}),
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
                      if (!d) throw new Error("expiraEm inválida");
                      return d;
                    })()
                  : null,
              }
            : {}),
      ...(naoExpira !== undefined ? { naoExpira: Boolean(naoExpira) } : {}),
          ...donoUpdate,
        },
      });

      const metodologiaIdsRaw = (body as any)?.metodologiaIds;
      const metodologiaIds: string[] = Array.isArray(metodologiaIdsRaw)
        ? metodologiaIdsRaw.map((x: any) => String(x).trim()).filter(Boolean)
        : [];

      if (Array.isArray(metodologiaIdsRaw)) {
        // se veio do front (mesmo vazio), sincroniza
        const userId = getUserId(req);
        if (!userId) throw new Error("Não autenticado.");

        if (metodologiaIds.length) {
          const metas = await (tx as any).metodologia.findMany({
            where: { id: { in: metodologiaIds }, criadorUsuarioId: userId },
            select: { id: true },
          });

          if (metas.length !== metodologiaIds.length) {
            throw new Error("Você só pode vincular às metodologias que você criou.");
          }
        }

        // remove vínculos que não estão mais na lista
        await (tx as any).metodologiaTreino.deleteMany({
          where: {
            treinoProgramadoId: id,
            ...(metodologiaIds.length ? { metodologiaId: { notIn: metodologiaIds } } : {}),
          },
        });

        // adiciona os novos
        if (metodologiaIds.length) {
          await (tx as any).metodologiaTreino.createMany({
            data: metodologiaIds.map((metodologiaId) => ({
              metodologiaId,
              treinoProgramadoId: id,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (exsBanco.length) {
        const novosOficiais = exsBanco
          .map((e) => e?.exercicioId ?? e?.id)
          .filter(Boolean) as string[];
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
      // vamos manter um set de temporários usados, para apagar o que sobrar depois
      const keepTempIds = new Set<string>();
      // para estatística (só oficiais)
      const novosOficiais: string[] = [];
      // ✅ fonte única dos exercícios do payload (id / exercicioId / temporário)
      const exerciciosBody: any[] = Array.isArray((body as any)?.exercicios)
        ? (body as any).exercicios
        : Array.isArray(exercicios)
          ? exercicios
          : [];

      // ✅ limpar vínculos antigos do treino (para recriar a lista do zero)
      await tx.treinoProgramadoExercicio.deleteMany({
        where: { treinoProgramadoId: id },
      });

      for (let i = 0; i < exerciciosBody.length; i++) {
        const ex = exerciciosBody[i] ?? {};
        const repeticoes = String(ex?.repeticoes ?? ex?.repeticao ?? ex?.reps ?? "");
        const ordem = Number.isFinite(Number(ex?.ordem)) ? Number(ex.ordem) : i + 1;

        // 1) oficial pode vir exercicioId ou id
        const exercicioId = ex?.exercicioId ?? ex?.id ?? null;
        if (exercicioId) {
          const exId = String(exercicioId);
          const repeticoesFinal = String(ex?.repeticoes ?? ex?.repeticao ?? ex?.reps ?? "").trim();
          const seriesFinal =
            Number.isFinite(Number(ex.series)) && Number(ex.series) > 0
              ? Number(ex.series)
              : null;
          const duracaoFinal =
            ex.duracao != null && String(ex.duracao).trim() !== ""
              ? String(ex.duracao).trim()
              : null;
          const descansoFinal =
            ex.descanso != null && String(ex.descanso).trim() !== ""
              ? String(ex.descanso).trim()
              : null;

          const descricaoSalvar =
            typeof ex?.descricao === "string" && ex.descricao.trim()
              ? ex.descricao.trim()
              : typeof ex?.observacao === "string" && ex.observacao.trim()
              ? ex.observacao.trim()
              : typeof ex?.descricaoExecucao === "string" && ex.descricaoExecucao.trim()
              ? ex.descricaoExecucao.trim()
              : null;

          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: id,
              exercicioId: exId,
              repeticoes: repeticoesFinal,
              ordem,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              descricaoExecucao: descricaoSalvar,
            },
          });

          await tx.exercicio.update({
            where: { id: exId },
            data: {
              repeticoes: repeticoesFinal || null,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              objetivo: descricaoSalvar,
            },
          });

          novosOficiais.push(exId);
          continue;
        }

        const exercicioPersonalizadoId = ex?.exercicioPersonalizadoId ?? null;
        if (exercicioPersonalizadoId) {
          const persId = String(exercicioPersonalizadoId);

          const descricaoSalvar =
            typeof ex?.descricao === "string" && ex.descricao.trim()
              ? ex.descricao.trim()
              : typeof ex?.observacao === "string" && ex.observacao.trim()
              ? ex.observacao.trim()
              : typeof ex?.descricaoExecucao === "string" && ex.descricaoExecucao.trim()
              ? ex.descricaoExecucao.trim()
              : null;

          const pers = await tx.exercicioPersonalizado.findUnique({
            where: { id: persId },
            select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
          });

          if (!pers) {
            throw new Error(`ExercicioPersonalizadoId inválido no índice ${i}`);
          }

          const novoVideo =
            (ex?.videoDemonstrativoUrl ?? ex?.videoUrl ?? null)
              ? String(ex?.videoDemonstrativoUrl ?? ex?.videoUrl)
              : null;

          const novoPoster = ex?.videoPosterUrl ? String(ex.videoPosterUrl) : null;

          await tx.exercicioPersonalizado.update({
            where: { id: persId },
            data: {
              descricao: descricaoSalvar,
              ...((!pers.videoDemonstrativoUrl || pers.videoDemonstrativoUrl === "") && novoVideo
                ? { videoDemonstrativoUrl: novoVideo }
                : {}),
              ...((!pers.videoPosterUrl || pers.videoPosterUrl === "") && novoPoster
                ? { videoPosterUrl: novoPoster }
                : {}),
            },
          });

          const repeticoesFinal = String(
            ex?.repeticoes ?? ex?.repeticao ?? ex?.reps ?? ""
          ).trim();

          const seriesFinal =
            Number.isFinite(Number(ex?.series)) && Number(ex.series) > 0
              ? Number(ex.series)
              : null;

          const duracaoFinal =
            ex?.duracao != null && String(ex.duracao).trim() !== ""
              ? String(ex.duracao).trim()
              : null;

          const descansoFinal =
            ex?.descanso != null && String(ex.descanso).trim() !== ""
              ? String(ex.descanso).trim()
              : null;

          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: id,
              exercicioPersonalizadoId: persId,
              repeticoes: repeticoesFinal,
              ordem,
              series: seriesFinal,
              duracao: duracaoFinal,
              descanso: descansoFinal,
              descricaoExecucao: descricaoSalvar,
            },
          });

          continue;
        }
        // 2) temporário pode vir como id direto
        const exercicioTemporarioId = ex?.exercicioTemporarioId ?? ex?.tempId ?? null;
        if (exercicioTemporarioId) {
          const tempId = String(exercicioTemporarioId);

          const descricaoSalvar =
            typeof ex?.descricao === "string" && ex.descricao.trim()
              ? ex.descricao.trim()
              : typeof ex?.observacao === "string" && ex.observacao.trim()
              ? ex.observacao.trim()
              : typeof ex?.descricaoExecucao === "string" && ex.descricaoExecucao.trim()
              ? ex.descricaoExecucao.trim()
              : null;

          // ✅ segurança: só deixa usar temporário que é desse treino
          const exists = await tx.exercicioTemporario.findFirst({
            where: { id: tempId, treinoProgramadoId: id },
            select: { id: true },
          });

          if (!exists) {
            throw new Error(`ExercicioTemporarioId inválido (não pertence ao treino) no índice ${i}`);
          }

          await tx.exercicioTemporario.update({
            where: { id: tempId },
            data: { descricao: descricaoSalvar },
          });

          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: id,
              exercicioTemporarioId: tempId,
              repeticoes,
              ordem, // ✅ obrigatório
              series:
                Number.isFinite(Number(ex.series)) && Number(ex.series) > 0
                  ? Number(ex.series)
                  : null,
              duracao:
                ex.duracao != null && String(ex.duracao).trim() !== ""
                  ? String(ex.duracao).trim()
                  : null,
              descanso:
                ex.descanso != null && String(ex.descanso).trim() !== ""
                  ? String(ex.descanso).trim()
                  : null,
              descricaoExecucao: descricaoSalvar,
            },
          });

          keepTempIds.add(tempId);
          continue;
        }

        // 3) temporário pode vir como objeto
        const tempObj =
          ex?.exercicioTemporario ??
          ex?.temporario ??
          ex?.exercicio_temporario ??
          null;

        if (tempObj) {
          const nomeTemp = String(tempObj?.nome ?? tempObj?.titulo ?? "").trim();
          if (!nomeTemp) throw new Error(`Exercício temporário sem nome no índice ${i}`);

          // herda vídeo (se existir no catálogo)
          const videoHerdado = await herdarVideoParaTemporarioTx(tx as any, nomeTemp);

          // tenta reutilizar temporário existente com mesmo nome (nesse treino)
          let temp = await tx.exercicioTemporario.findFirst({
            where: {
              treinoProgramadoId: id,
              nome: { equals: nomeTemp, mode: "insensitive" },
            },
            select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
          });

          const descricaoSalvar =
            typeof ex?.descricao === "string" && ex.descricao.trim()
              ? ex.descricao.trim()
              : typeof ex?.observacao === "string" && ex.observacao.trim()
              ? ex.observacao.trim()
              : typeof ex?.descricaoExecucao === "string" && ex.descricaoExecucao.trim()
              ? ex.descricaoExecucao.trim()
              : null;

          if (!temp) {
            temp = await tx.exercicioTemporario.create({
              data: {
                treinoProgramadoId: id,     // ✅ obrigatório
                codigo: null,
                nome: nomeTemp,
                descricao: descricaoSalvar,
                nivel: (nivel !== undefined ? nivel : "Base"), // ✅ obrigatório
                categorias: categoriasNorm ?? [],              // ✅ obrigatório
                videoDemonstrativoUrl:
                  tempObj?.videoDemonstrativoUrl ??
                  tempObj?.videoUrl ??
                  videoHerdado ??
                  null,
                videoPosterUrl:
                  tempObj?.videoPosterUrl ??
                  ex?.videoPosterUrl ??
                  null,
              },
              select: { id: true, videoDemonstrativoUrl: true, videoPosterUrl: true },
            });
          } else {
            // se não tem vídeo e achamos um pra herdar, atualiza
            if ((!temp.videoDemonstrativoUrl || temp.videoDemonstrativoUrl === "") && videoHerdado) {
              await tx.exercicioTemporario.update({
                where: { id: temp.id },
                data: { videoDemonstrativoUrl: videoHerdado },
              });
            }

            if (descricaoSalvar) {
              await tx.exercicioTemporario.update({
                where: { id: temp.id },
                data: { descricao: descricaoSalvar },
              });
            }
          }

          const posterNovo =
            tempObj?.videoPosterUrl ??
            ex?.videoPosterUrl ??
            null;

          if ((!temp.videoPosterUrl || temp.videoPosterUrl === "") && posterNovo) {
            await tx.exercicioTemporario.update({
              where: { id: temp.id },
              data: { videoPosterUrl: String(posterNovo) },
            });
          }

          await tx.treinoProgramadoExercicio.create({
            data: {
              treinoProgramadoId: id,
              exercicioTemporarioId: temp.id,
              repeticoes,
              ordem, // ✅ obrigatório
              series:
                Number.isFinite(Number(ex.series)) && Number(ex.series) > 0
                  ? Number(ex.series)
                  : null,
              duracao:
                ex.duracao != null && String(ex.duracao).trim() !== ""
                  ? String(ex.duracao).trim()
                  : null,
              descanso:
                ex.descanso != null && String(ex.descanso).trim() !== ""
                  ? String(ex.descanso).trim()
                  : null,
              descricaoExecucao: descricaoSalvar,
            },
          });

          keepTempIds.add(temp.id);
          continue;
        }

        // nada reconhecido
        throw new Error(`Exercício inválido no índice ${i} (sem exercicioId e sem temporário)`);
      }

      // ✅ apaga temporários que sobraram (não estão mais na lista)
     if (keepTempIds.size) {
        await tx.exercicioTemporario.deleteMany({
          where: {
            treinoProgramadoId: id,
            id: { notIn: Array.from(keepTempIds) },
          },
        });
      }
      // se keepTempIds estiver vazio, não apaga nada automaticamente

    });

    const novosOficiais = exsBanco.map((e) => e.exercicioId).filter(Boolean) as string[];
    const novosIds = novosOficiais.map((s) => String(s).trim()).filter(Boolean);
    const exercicioIds = Array.from(new Set([
      ...Array.from(antigosSet),
      ...novosIds,
    ])).filter(Boolean);

    if (exercicioIds.length) {
      await recalcularEstatisticaExercicios(exercicioIds);
    }

    const updated = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        exercicios: { include: { exercicio: true, exercicioPersonalizado: true, exercicioTemporario: true } },
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

export const deletarTreinoProgramado = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const usuarioId = req.userId;

    if (!usuarioId) return res.status(401).json({ message: "Não autenticado." });

    const treino = await prisma.treinoProgramado.findUnique({
      where: { id },
      select: {
        id: true,
        professorId: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!treino) return res.status(404).json({ message: "Treino não encontrado." });

    // ✅ TODO: coloque aqui sua regra real de permissão
    // Exemplo (se você tiver req.tipo / req.tipoUsuarioId):
    // if (!ehDonoDoTreino(req, treino)) return res.status(403).json({ message: "Sem permissão." });

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1) pegar agendamentos futuros desse treino (somente futuros)
      const futuros = await tx.treinoAgendado.findMany({
        where: {
          treinoProgramadoId: id,
          dataTreino: { gte: now },
        },
        select: { id: true },
      });

      const futurosIds = futuros.map((a) => a.id);

      // 2) apagar submissões relacionadas a agendamentos futuros
      if (futurosIds.length) {
        await tx.submissaoTreino.deleteMany({
          where: { treinoAgendadoId: { in: futurosIds } },
        });

        // 3) apagar os agendamentos futuros
        await tx.treinoAgendado.deleteMany({
          where: { id: { in: futurosIds } },
        });
      }

      // 4) apagar atividades recentes relacionadas ao treino programado
      // (⚠️ sem treinoAgendadoId porque não existe no seu schema)
      await tx.atividadeRecente.deleteMany({
        where: { id: id },
      });

      // 5) apagar tabelas de vínculo do treino programado
      await tx.treinoProgramadoExercicio.deleteMany({
        where: { treinoProgramadoId: id },
      });

      await tx.exercicioTemporario.deleteMany({
        where: { treinoProgramadoId: id },
      });

      // 6) por último: deletar o treino programado
      // OBS: isso só vai funcionar se NÃO existir FK obrigatória apontando pra ele
      // a partir de registros passados. Se existir, a gente muda pra "arquivar".
      await tx.treinoProgramado.delete({ where: { id } });
    });

    return res.json({
      ok: true,
      message: "Treino excluído. Agendamentos futuros e submissões relacionadas foram removidos.",
    });
  } catch (e: any) {
    console.error("deletarTreinoProgramado erro:", e);
    return res.status(500).json({ message: e?.message || "Erro ao excluir treino." });
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

    if (aprovado === true && !wasApprovedBefore && tp?.id) {
      try {
        await recomputeFeitosTreino(String(tp.id));
      } catch (e) {
        console.warn("recomputeFeitosTreino falhou em validarSubmissaoTreino:", e);
      }
    }

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

    try {
      await recomputePontuacaoAtleta(sub.atletaId);
    } catch (e) {
      console.warn("recomputePontuacaoAtleta falhou (não é crítico para a aprovação):", e);
    }

    if (aprovado === true && !wasApprovedBefore) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
      } catch (e) {
        console.warn("stats (feito por aluno) falhou no validarSubmissaoTreino:", e);
      }
    }

        await audit(req, {
      acao: "VALIDAR_SUBMISSAO_TREINO",
      entidade: "SubmissaoTreino",
      entidadeId: atualizado.id,
      descricao: aprovado ? "Submissão aprovada" : "Submissão reprovada",
      meta: {
        atletaId: sub.atletaId,
        treinoAgendadoId: sub.treinoAgendadoId,
        treinoProgramadoId: tp?.id ?? null,
        aprovado,
        pontosBase,
        pontosChecklist: pontosDoChecklist,
        pontosInformados: Number.isFinite(Number(pontos)) ? Number(pontos) : null,
        pontosFinais,
        validadorEntidade: resolved,
      },
    });

    return res.json({
      ok: true,
      aprovado,
      pontosFinais,
      submissao: atualizado,
    });
  } catch (e) {
    console.error("validarSubmissaoTreino", e);
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
      turmaIds = [],        // ✅ ADD
      incluirObservados = false,
    } = req.body as {
      treinoProgramadoId: string;
      datas: string[];
      atletaIds?: string[];
      elencosIds?: string[];
      turmaIds?: string[];  // ✅ ADD
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

    // ✅ atletas vindos de TURMAS (turmaUsuario -> atleta.usuarioId)
    const turmaIdsClean = Array.isArray(turmaIds)
      ? turmaIds.map(String).map((s) => s.trim()).filter(Boolean)
      : [];

    const atletasFromTurmas = turmaIdsClean.length
      ? await (async () => {
          const resolvedMe = resolved;
          const tipoUser = resolvedMe?.tipo;

          const turmaOwnerOr: Prisma.TurmaWhereInput[] = [];
          if (tipoUser === "professor" && resolvedMe?.id) {
            turmaOwnerOr.push({
              professores: { some: { professorId: resolvedMe.id } },
            });
          }
          if (tipoUser === "clube" && resolvedMe?.id) {
            turmaOwnerOr.push({ clubeId: resolvedMe.id });
          }
          if (tipoUser === "escolinha" && resolvedMe?.id) {
            turmaOwnerOr.push({ escolinhaId: resolvedMe.id });
          }

          const turmasOk = await prisma.turma.findMany({
            where: {
              id: { in: turmaIdsClean },
              ...(turmaOwnerOr.length ? { OR: turmaOwnerOr } : {}),
            },
            select: { id: true },
          });

          const turmasOkIds = new Set(turmasOk.map((t) => String(t.id)));
          const turmasValidas = turmaIdsClean.filter((id) => turmasOkIds.has(String(id)));

          if (!turmasValidas.length) {
            return [] as Array<{ atletaId: string; turmaId: string }>;
          }

          // pega membros por turma
          const membros = await prisma.turmaUsuario.findMany({
            where: { turmaId: { in: turmasValidas } },
            select: { turmaId: true, usuarioId: true },
          });

          const usuarioIds = Array.from(
            new Set(membros.map((m) => String(m.usuarioId)).filter(Boolean))
          );

          if (!usuarioIds.length) {
            return [] as Array<{ atletaId: string; turmaId: string }>;
          }

          const atletas = await prisma.atleta.findMany({
            where: { usuarioId: { in: usuarioIds } },
            select: { id: true, usuarioId: true },
          });

          const atletaIdByUsuarioId = new Map(
            atletas.map((a) => [String(a.usuarioId), String(a.id)])
          );

          const pares: Array<{ atletaId: string; turmaId: string }> = [];
          const seen = new Set<string>();

          for (const m of membros) {
            const atletaId = atletaIdByUsuarioId.get(String(m.usuarioId));
            const turmaId = String(m.turmaId || "").trim();

            if (!atletaId || !turmaId) continue;

            const key = `${atletaId}__${turmaId}`;
            if (seen.has(key)) continue;
            seen.add(key);

            pares.push({ atletaId, turmaId });
          }

          return pares;
        })()
      : [];

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

    const atletaIdsDiretosFinal = Array.from(
      new Set([
          ...atletasDiretos.map((a) => String(a.id)),
          ...atletasFromElencos.map((a) => String(a.atletaId)),
          ...observados.map((a) => String(a.id)),
        ].filter(Boolean))
      );

      const atletaIdsTurmasFinal = Array.from(
        new Set(atletasFromTurmas.map((a) => String(a.atletaId)).filter(Boolean))
      );

      const atletaIdsFinal = Array.from(
        new Set([
          ...atletaIdsDiretosFinal,
          ...atletaIdsTurmasFinal,
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
      .map((s) => parseDateInput(s))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));

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

      // 1) atletas vindos de turma => salva turmaId
      for (const item of atletasFromTurmas) {
        toCreate.push({
          titulo: tp.nome ?? "Treino",
          atletaId: item.atletaId,
          treinoProgramadoId: tp.id,
          turmaId: item.turmaId, // ✅ AQUI salva a turma
          dataTreino: dt,
          dataOriginal: dt,
          dataExpiracao,
          status: TreinoAgendadoStatus.AGENDADO,
          criadoPorProfessorId,
        });
      }

      // 2) atletas diretos / elenco / observados => sem turma
      for (const atletaId of atletaIdsDiretosFinal) {
        toCreate.push({
          titulo: tp.nome ?? "Treino",
          atletaId,
          treinoProgramadoId: tp.id,
          turmaId: null,
          dataTreino: dt,
          dataOriginal: dt,
          dataExpiracao,
          status: TreinoAgendadoStatus.AGENDADO,
          criadoPorProfessorId,
        });
      }
    }

    const seenCreate = new Set<string>();

    const toCreateUnique = toCreate.filter((item) => {
      const key = [
        item.atletaId,
        item.treinoProgramadoId,
        item.turmaId ?? "sem-turma",
        item.dataTreino instanceof Date ? item.dataTreino.toISOString() : String(item.dataTreino),
      ].join("__");

      if (seenCreate.has(key)) return false;
      seenCreate.add(key);
      return true;
    });

    const created = await prisma.treinoAgendado.createMany({
      data: toCreateUnique,
      skipDuplicates: true,
    });

    await prisma.estatisticaTreino.upsert({
      where: { treinoId: tp.id },
      create: { treinoId: tp.id,  realizacoes: 0, ultimoRealizadoEm: new Date() },
      update: { ultimoRealizadoEm: new Date() },
    });

    await audit(req as any, {
      acao: "AGENDAR_ROTINA_MENSAL",
      entidade: "TreinoAgendado",
      entidadeId: tp.id,
      descricao: "Rotina mensal agendada",
      meta: {
        treinoProgramadoId: tp.id,
        totalSolicitado: toCreateUnique.length,
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
      solicitado: toCreateUnique.length,
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
    const tipo = String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    const atletaId = req.user?.tipoUsuarioId ? String(req.user.tipoUsuarioId) : null;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: { atleta: { select: { usuarioId: true } } },
    });

    if (!ag) {
      return res.status(404).json({ message: "Treino agendado não encontrado." });
    }

    const podeIniciarComoNaoAtleta =
      ["professor", "clube", "escolinha", "admin"].includes(tipo) ||
      String(usuario?.tipo || "").toLowerCase() === "admin";

    if (ag.atletaId) {
      if (ag.atletaId !== atletaId || ag.atleta?.usuarioId !== usuarioId) {
        return res.status(403).json({ message: "Não autorizado para iniciar este treino." });
      }
    } else {
      if (!podeIniciarComoNaoAtleta) {
        return res.status(403).json({ message: "Não autorizado para iniciar este treino." });
      }
    }

    const now = new Date();

    const [updated, treinoUsuario] = await prisma.$transaction([
      prisma.treinoAgendado.update({
        where: { id },
        data: {
          startedAt: now,
          status: TreinoAgendadoStatus.EM_ANDAMENTO,
        },
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
      meta: {
        atletaId: updated.atletaId ?? null,
        dataTreino: updated.dataTreino,
        status: "EmAndamento",
      },
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
    const tipo = String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    const atletaId = req.user?.tipoUsuarioId ? String(req.user.tipoUsuarioId) : null;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: { atleta: { select: { usuarioId: true } } },
    });

    if (!ag) {
      return res.status(404).json({ message: "Treino agendado não encontrado." });
    }

    const podeFinalizarComoNaoAtleta =
      ["professor", "clube", "escolinha", "admin"].includes(tipo) ||
      String(usuario?.tipo || "").toLowerCase() === "admin";

    if (ag.atletaId) {
      if (ag.atletaId !== atletaId || ag.atleta?.usuarioId !== usuarioId) {
        return res.status(403).json({ message: "Não autorizado." });
      }
    } else {
      if (!podeFinalizarComoNaoAtleta) {
        return res.status(403).json({ message: "Não autorizado." });
      }
    }

    const { metodologiaId } = req.body as {
      metodologiaId?: string | null;
    };

    const tipoUsuario = String(req.user?.tipo ?? req.user?.tipoUsuario ?? "").toLowerCase();
    const ehAdmin =
      tipoUsuario === "admin" || String(usuario?.tipo || "").toLowerCase() === "admin";

    // admin pode finalizar treino de metodologia sem cair em limite
    if (!ehAdmin && req.user?.plano !== "PRO") {
      const ok = await requireUsage(req as any, res, "treinos_semana");
      if (!ok) return;
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

    const [updated, treinoUsuario] = await prisma.$transaction([
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
    ]);

    await audit(req, {
      acao: "ALTERAR_AGENDA",
      entidade: "TreinoAgendado",
      entidadeId: id,
      descricao: "Treino agendado finalizado",
      meta: {
        atletaId: updated.atletaId ?? null,
        dataTreino: updated.dataTreino,
        status: "Concluido",
        duracaoSegundos: duracao,
        metodologiaId: metodologiaId ?? null,
      },
    });

    if (updated.atletaId && ag.atleta?.usuarioId) {
      syncAgendaAtleta(ag.atleta.usuarioId, updated.atletaId);
    }

    return res.json({
      ok: true,
      treino: updated,
      treinoUsuario,
      finishedAt,
      duracaoSegundos: duracao,
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

export async function getTreinosRealizadosCount(req: AuthenticatedRequest, res: Response) {
  try {
    const idsParam = req.query.ids;

    let ids: string[] = [];
    if (Array.isArray(idsParam)) {
      ids = idsParam.map(String).flatMap(s => s.split(",")).map(s => s.trim()).filter(Boolean);
    } else {
      ids = String(idsParam ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    }

    if (!ids.length) return res.json({});

    const rows = await prisma.treinoRealizado.groupBy({
      by: ["treinoId"],
      where: { treinoId: { in: ids } },
      _count: { _all: true },
    });

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.treinoId] = r._count._all;
    }

    for (const id of ids) {
      if (map[id] == null) map[id] = 0;
    }

    return res.json(map);
  } catch (e) {
    console.error("getTreinosRealizadosCount error:", e);
    return res.status(500).json({ error: "Erro ao contar treinos realizados" });
  }
}

function startEndOfDayISO(dayISO: string) {
  const [y, m, d] = dayISO.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return { start, end };
}

export async function listarAlunosTreinoAgendadoTurma(req: Request, res: Response) {
  try {
    const turmaId = String(req.query.turmaId ?? "").trim();
    const treinoProgramadoId = String(req.query.treinoProgramadoId ?? "").trim();
    const day = String(req.query.day ?? "").trim(); // YYYY-MM-DD

    if (!turmaId || !treinoProgramadoId || !day) {
      return res
        .status(400)
        .json({ message: "Informe turmaId, treinoProgramadoId e day (YYYY-MM-DD)." });
    }

    const { start, end } = startEndOfDayISO(day);

    // 1) membros da turma (usuarioId)
    const membros = await prisma.turmaUsuario.findMany({
      where: { turmaId },
      select: { usuarioId: true },
    });
    const usuarioIds = membros.map((m) => m.usuarioId).filter(Boolean);

    if (!usuarioIds.length) return res.json({ items: [] });

    // 2) atletas correspondentes aos usuários
    const atletas = await prisma.atleta.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { id: true, usuarioId: true, nome: true, sobrenome: true, foto: true },
    });
    const atletaIds = atletas.map((a) => a.id);

    if (!atletaIds.length) return res.json({ items: [] });

    // 3) treinos agendados nesse dia para esse treinoProgramado (somente atletas da turma)
    const ags = await prisma.treinoAgendado.findMany({
      where: {
        treinoProgramadoId,
        atletaId: { in: atletaIds },
        dataTreino: { gte: start, lte: end },
      },
      select: {
        atleta: { select: { usuarioId: true, nome: true, sobrenome: true, foto: true } },
      },
    });

    // 4) unique por usuarioId
    const map = new Map<string, { usuarioId: string; nome: string; foto: string | null }>();

    for (const row of ags) {
      const a = row.atleta;
      if (!a?.usuarioId) continue;

      const nome = [a.nome, a.sobrenome].filter(Boolean).join(" ").trim() || "Atleta";
      map.set(String(a.usuarioId), {
        usuarioId: String(a.usuarioId),
        nome,
        foto: a.foto ?? null,
      });
    }

    return res.json({ items: Array.from(map.values()) });
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message ?? "Erro ao buscar alunos do treino agendado.",
    });
  }
}

export async function listarExerciciosPersonalizados(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const itens = await prisma.exercicioPersonalizado.findMany({
      where: {
        criadorUsuarioId: {
          not: userId,
        },
      },
      orderBy: [
        { atualizadoEm: "desc" },
        { nome: "asc" },
      ],
      take: 500,
    });

    const personalizados = await prisma.exercicioPersonalizado.findMany({
      where: {
        ...(userId
          ? {
              NOT: {
                criadorUsuarioId: userId,
              },
            }
          : {}),
      },
      orderBy: { nome: "asc" },
    });

    const oficiais = await prisma.exercicio.findMany({
      select: {
        id: true,
        nome: true,
        nomeNormalizado: true,
      },
    });

    const nomesOficiais = new Set(
      oficiais
        .map((e) => e.nomeNormalizado || normalizarNomeExercicio(e.nome))
        .filter(Boolean)
    );

    const itensSemDuplicarOficial = itens.filter((item: any) => {
      const nomeNorm = normalizarNomeExercicio(item.nome);
      if (nomeNorm && nomesOficiais.has(nomeNorm)) {
        return false;
      }
      return true;
    });

    const unicos = deduplicarExerciciosPorNome(itensSemDuplicarOficial);

    return res.json(unicos);
  } catch (error) {
    console.error("Erro ao listar exercícios personalizados:", error);
    return res.status(500).json({ message: "Erro ao listar exercícios personalizados." });
  }
}

export async function atualizarExercicioPersonalizado(req: any, res: Response) {
  const userId = String(req.user?.id || "").trim();
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido." });

  const {
    nome,
    descricao,
    nivel,
    categorias,
    videoDemonstrativoUrl,
    videoPosterUrl,
  } = req.body ?? {};

  // garante ownership
  const atual = await prisma.exercicioPersonalizado.findFirst({
    where: { id, criadorUsuarioId: userId },
  });
  if (!atual) return res.status(404).json({ message: "Exercício não encontrado." });

  const updated = await prisma.exercicioPersonalizado.update({
    where: { id },
    data: {
      ...(typeof nome === "string" ? { nome: nome.trim() } : {}),
      ...(typeof descricao === "string" ? { descricao: descricao.trim() } : {}),
      ...(nivel ? { nivel } : {}),
      ...(Array.isArray(categorias) ? { categorias } : {}),
      ...(videoDemonstrativoUrl !== undefined ? { videoDemonstrativoUrl } : {}),
      ...(videoPosterUrl !== undefined ? { videoPosterUrl } : {}),
    },
  });

  return res.json(updated);
}

export async function deletarExercicioPersonalizado(req: any, res: Response) {
  const userId = String(req.user?.id || "").trim();
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  const id = String(req.params?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido." });

  // garante ownership
  const atual = await prisma.exercicioPersonalizado.findFirst({
    where: { id, criadorUsuarioId: userId },
  });
  if (!atual) return res.status(404).json({ message: "Exercício não encontrado." });

  // se estiver em uso em algum treino, você pode bloquear aqui (opcional)
  const emUso = await prisma.treinoProgramadoExercicio.count({
    where: { exercicioPersonalizadoId: id },
  });
  if (emUso > 0) {
    return res.status(409).json({
      message: "Este exercício já está em uso em um treino. Remova do treino antes de excluir.",
    });
  }

  await prisma.exercicioPersonalizado.delete({ where: { id } });
  return res.json({ ok: true });
}

export async function iniciarTreinoViaMetodologia(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const treinoProgramadoId = String(req.params.id || "").trim();
    if (!treinoProgramadoId) {
      return res.status(400).json({ message: "treinoProgramadoId é obrigatório." });
    }

    const [atleta, professor, clube, escolinha, usuario] = await Promise.all([
      prisma.atleta.findUnique({
        where: { usuarioId },
        select: { id: true },
      }),
      prisma.professor.findFirst({
        where: { usuarioId },
        select: { id: true },
      }),
      prisma.clube.findFirst({
        where: { usuarioId },
        select: { id: true },
      }),
      prisma.escolinha.findFirst({
        where: { usuarioId },
        select: { id: true },
      }),
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, tipo: true },
      }),
    ]);

    const podeExecutar =
      !!atleta?.id ||
      !!professor?.id ||
      !!clube?.id ||
      !!escolinha?.id ||
      String(usuario?.tipo || "").toLowerCase() === "admin";

    if (!podeExecutar) {
      return res.status(403).json({
        message: "Seu tipo de usuário não pode iniciar treino via metodologia.",
      });
    }
    const treinoProgramado = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: { id: true, nome: true },
    });

    if (!treinoProgramado) {
      return res.status(404).json({ message: "Treino programado não encontrado." });
    }

    const now = new Date();
    const startDay = new Date(now);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(now);
    endDay.setHours(23, 59, 59, 999);

    const atletaId = atleta?.id ?? null;

    let agendado = await prisma.treinoAgendado.findFirst({
      where: {
        treinoProgramadoId,
        dataTreino: {
          gte: startDay,
          lte: endDay,
        },
        ...(atletaId ? { atletaId } : { titulo: { startsWith: `[METODOLOGIA:${usuarioId}]` } }),
      },
      orderBy: { startedAt: "desc" },
    });

    if (!agendado) {
      const dataExpiracao = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const dataCreate: Prisma.TreinoAgendadoUncheckedCreateInput = {
        titulo: atletaId
          ? (treinoProgramado.nome ?? "Treino")
          : `[METODOLOGIA:${usuarioId}] ${treinoProgramado.nome ?? "Treino"}`,
        atletaId: atletaId ?? null,
        treinoProgramadoId,
        dataTreino: now,
        dataOriginal: now,
        dataExpiracao,
        status: TreinoAgendadoStatus.AGENDADO,
      };

      agendado = await prisma.treinoAgendado.create({
        data: dataCreate,
      });
    }

    const treinoUsuario = await prisma.treinoUsuario.upsert({
      where: {
        treinoId_usuarioId: {
          treinoId: agendado.id,
          usuarioId,
        },
      },
      create: {
        treinoId: agendado.id,
        usuarioId,
        status: TreinoStatus.IN_PROGRESS,
        startedAt: now,
      },
      update: {
        status: TreinoStatus.IN_PROGRESS,
        startedAt: now,
        completedAt: null,
      },
    });

    await prisma.treinoAgendado.update({
      where: { id: agendado.id },
      data: {
        status: TreinoAgendadoStatus.EM_ANDAMENTO,
        startedAt: now,
      },
    });

    return res.json({
      ok: true,
      treinoAgendadoId: agendado.id,
      treino: agendado,
      treinoUsuario,
      startedAt: treinoUsuario.startedAt,
    });
  } catch (e: any) {
    console.error("iniciarTreinoViaMetodologia", e);
    return res.status(500).json({
      message: e?.message || "Erro ao iniciar treino via metodologia.",
    });
  }
}

export async function uploadExecucaoVideoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ message: "Arquivo não enviado." });
    }

    const location = (file as any).location || null;
    if (!location) {
      return res.status(500).json({ message: "Upload sem URL retornada pelo S3." });
    }

    return res.status(201).json({
      ok: true,
      url: location,
      key: (file as any).key ?? null,
      mimetype: file.mimetype ?? null,
      size: file.size ?? null,
      originalname: file.originalname ?? null,
    });
  } catch (e) {
    console.error("uploadExecucaoVideoTreino", e);
    return res.status(500).json({ message: "Erro ao enviar vídeo de execução." });
  }
}

export async function salvarVideosExecucaoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; // treinoAgendadoId
    const usuarioId = req.userId!;

    const { updates } = req.body as {
      updates?: Array<{
        exerciseRowId: string;
        kind: "catalogo" | "temporario" | "personalizado";
        entityId: string;
        existingUrl?: string | null;
        uploadedUrl: string;
        selectedUrl?: string | null;
        saveMode: "SESSION_ONLY" | "UPDATE_OFFICIAL";
        officialChoice?: "KEEP_OLD" | "USE_NEW" | null;
      }>;
    };

    if (!Array.isArray(updates) || !updates.length) {
      return res.status(400).json({ message: "Nenhuma atualização enviada." });
    }

    if (!usuarioId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    console.log("[salvarVideosExecucaoTreino] id recebido:", id);
    console.log("[salvarVideosExecucaoTreino] updates:", updates?.length ?? 0);

    const treinoAgendado = await prisma.treinoAgendado.findUnique({
      where: { id },
      include: {
        treinoProgramado: {
          include: {
            exercicios: true,
          },
        },
      },
    });

    if (!treinoAgendado) {
      console.log("[salvarVideosExecucaoTreino] treinoAgendado não encontrado para id:", id);
      return res.status(404).json({ message: "Treino agendado não encontrado." });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        if (!item.uploadedUrl || !item.selectedUrl || !item.entityId) continue;

        if (item.saveMode === "UPDATE_OFFICIAL") {
          if (item.kind === "catalogo") {
            const atual = await tx.exercicio.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicio.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.selectedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.selectedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }
          }

          if (item.kind === "temporario") {
            const atual = await tx.exercicioTemporario.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioTemporario.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.selectedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.selectedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }
          }

          if (item.kind === "personalizado") {
            const atual = await tx.exercicioPersonalizado.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioPersonalizado.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.selectedUrl,
              },
            });

            
            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.selectedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }
          }
        }

        if (item.saveMode === "SESSION_ONLY") {
          await tx.midia.create({
            data: {
              titulo: `Execução do exercício ${item.exerciseRowId}`,
              tipo: TipoMidia.Video,
              url: item.uploadedUrl,
              dataEnvio: new Date(),
              descricao: JSON.stringify({
                origem: "treino_execucao_instrutor",
                treinoAgendadoId: id,
                exerciseRowId: item.exerciseRowId,
                kind: item.kind,
                entityId: item.entityId,
                criadoPorUsuarioId: usuarioId,
              }),
              storageClass: "HOT" as any,
            } as any,
          });

          continue;
        }

        if (item.saveMode === "UPDATE_OFFICIAL") {
          if (item.officialChoice === "KEEP_OLD") {
            continue;
          }

          if (item.officialChoice !== "USE_NEW" || !item.uploadedUrl) {
            continue;
          }

          if (item.kind === "catalogo") {
            const atual = await tx.exercicio.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicio.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }

          if (item.kind === "temporario") {
            const atual = await tx.exercicioTemporario.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioTemporario.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }

          if (item.kind === "personalizado") {
            const atual = await tx.exercicioPersonalizado.findUnique({
              where: { id: item.entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioPersonalizado.update({
              where: { id: item.entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }
        }
      }
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("salvarVideosExecucaoTreino", e);
    return res.status(500).json({ message: "Erro ao salvar vídeos da execução." });
  }
}