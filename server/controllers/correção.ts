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
  const rows = await prisma.submissaoTreino.findMany({
    where: {
      aprovado: true,
      treinoAgendado: {
        is: { treinoProgramadoId },
      },
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
      ultimoRealizadoEm: ultimo,
    },
    update: {
      ultimoRealizadoEm: ultimo,
    },
  });

  return total;
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

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
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

function syncTreinoProgramado(treinoProgramadoId: string) {
  const io = getIO();
  if (!io || !treinoProgramadoId) return;

  io.to("treinos:programados").emit("treinos:sync", { treinoProgramadoId });
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

    const catRaw = req.body?.categoria;

    // ✅ categoria agora é opcional: se vier vazia, segue com []
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
            { Professor: { is: { id: profId } } },
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
        where: { naoExpira: true, Professor: { is: { id: profId } } },
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

    // ✅ bloqueia nome duplicado antes de tentar criar (evita 500)
    const nomeTrim = String(nome || "").trim();

    const jaExisteNome = await prisma.treinoProgramado.findFirst({
      where: {
        nome: { equals: nomeTrim, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (jaExisteNome) {
      return res.status(409).json({
        code: "NOME_JA_UTILIZADO",
        message: 'Esse nome já está sendo utilizado. Troque o título do treino e tente novamente.',
      });
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

        ...(tipoNorm === "professor"
          ? { Professor: { connect: { id: String(tipoUsuarioId) } } }
          : {}),
        ...(tipoNorm === "clube"
          ? { clube: { connect: { id: String(tipoUsuarioId) } } }
          : {}),
        ...(tipoNorm === "escolinha"
          ? { escolinha: { connect: { id: String(tipoUsuarioId) } } }
          : {}),

        ...(professorCriadorId
          ? { criadorProfessor: { connect: { id: professorCriadorId } } }
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
        professores: { include: { professor: { select: { id: true, nome: true } } } },
        clube: { select: { id: true, nome: true } },
        escolinha: { select: { id: true, nome: true } },
      },
    });

// ✅ normaliza payload do front:
// - aceita e.exercicioId (padrão) OU e.id (quando o front manda "id")
// - decide se é do banco ou temporário
const exItems = Array.isArray(exercicios) ? exercicios : [];

const exsBanco = exItems
  .map((e: any, i: number) => ({
    exercicioId: String(e?.exercicioId ?? e?.id ?? "").trim() || null,
    repeticoes: String(e?.repeticoes ?? ""),
    ordem: Number.isFinite(Number(e?.ordem)) ? Number(e.ordem) : i + 1,
  }))
  .filter((e: any) => !!e.exercicioId);

const exsTemp = exItems
  .map((e: any, i: number) => ({
    nome: String(e?.nome ?? "").trim(),
    descricao: e?.descricao ?? null,
    repeticoes: String(e?.repeticoes ?? ""),
    ordem: Number.isFinite(Number(e?.ordem)) ? Number(e.ordem) : i + 1,
  }))
  .filter((e: any) => !e.nome ? false : true)
  // só temporário se NÃO veio id/exercicioId
  .filter((e: any, idx: number) => {
    const raw = exItems[idx];
    const hasId = String(raw?.exercicioId ?? raw?.id ?? "").trim();
    return !hasId;
  });


    if (exsBanco.length) {
      await prisma.treinoProgramadoExercicio.createMany({
        data: exsBanco.map((e: any) => ({
          treinoProgramadoId: treino.id,
          exercicioId: e.exercicioId,
          repeticoes: e.repeticoes,
          ordem: e.ordem,
        })),
        skipDuplicates: true,
      });
    }


    syncTreinoProgramado(treino.id);

// ✅ Tenta achar no BD um exercício "normal" com nome parecido,
// e se achar, salva como exercício do BD em vez de temporário.
const promoverParaBancoSeBater = async (nomeTemp: string) => {
  const nomeNorm = nomeTemp.trim();

  // match simples e seguro (sem fuzzy pesado):
  // 1) equals insensitive
  // 2) contains insensitive
  const achado = await prisma.exercicio.findFirst({
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


for (const [i, e] of exsTemp.entries()) {
  const nomeTemp = String(e.nome ?? "").trim();
  if (!nomeTemp) continue;

  // ✅ se bate com exercício do BD, grava como exercicioId (e NÃO como temporário)
  const exercicioBancoId = await promoverParaBancoSeBater(nomeTemp);
  if (exercicioBancoId) {
    await prisma.treinoProgramadoExercicio.create({
      data: {
        treinoProgramadoId: treino.id,
        exercicioId: exercicioBancoId,
        repeticoes: String(e.repeticoes ?? ""),
        ordem: e.ordem ?? exsBanco.length + i + 1,
      },
    });
    continue;
  }

  // ... segue fluxo de temporário (abaixo)


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
          categorias: categorias,
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
    console.warn("[criarTreinoProgramado] Falha ao recalcular estatísticas de exercícios:", e);
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
    // ✅ Prisma Unique Constraint
    if (err?.code === "P2002") {
      const target = err?.meta?.target;
      const fields = Array.isArray(target) ? target : [target].filter(Boolean);

      if (fields.includes("nome")) {
        return res.status(409).json({
          code: "NOME_JA_UTILIZADO",
          message: 'Esse nome já está sendo utilizado. Troque o título do treino e tente novamente.',
        });
      }

      if (fields.includes("codigo")) {
        return res.status(409).json({
          code: "CODIGO_JA_UTILIZADO",
          message: "Esse código já está sendo utilizado. Gere outro e tente novamente.",
        });
      }

      // fallback genérico
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