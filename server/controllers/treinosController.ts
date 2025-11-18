// server/controllers/treinosController.ts
import {
  PrismaClient,
  PosicaoCampo,
  Categoria,
  TipoTreino,
  TreinoStatus,
  TipoMidia,
  TreinoAgendadoStatus,
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
import { audit } from "server/services/audit.js";
import { enforceFeatureLimit } from "server/utils/featureLimit.js";

const prisma = new PrismaClient();
type Request = ExpressRequest;
type Response = ExpressResponse;

type AuthenticatedRequest = ExpressRequest & {
  userId?: string;
  user?: any;
};

const FAIR_USE_TURMA_MES = 30;


type CanKey = Parameters<typeof can>[1];

const CAP_CRIAR_TREINO: CanKey = "Treinos:CriarProgramado" as CanKey;
const FEAT = {
  TREINOS_ILIMITADOS:  "treinos.ilimitados"   as CanKey,
  ROTINAS_ILIMITADAS:  "rotinas.ilimitadas"   as CanKey,
  AGENDAMENTO_LOTE:    "agendamento.lote"     as CanKey,
  AGENDAMENTO_PESSOAL: "agendamento.pessoal"  as CanKey,  
} as const;

export async function agendarTreinoPessoal(req: AuthenticatedRequest, res: Response) {
  const user = req.user as any;

  if (!user || !can(user, FEAT.AGENDAMENTO_PESSOAL)) {
    return res.status(402).json({
      code: "UPGRADE_REQUIRED",
      message: "Agendamento pessoal de treinos está disponível apenas para planos Pro.",
    });
  }

  const atletaId = req.user?.atletaId;
  if (!atletaId) {
    return res.status(400).json({ message: "Usuário não é atleta." });
  }

  const { titulo, dataTreino, descricao } = req.body as {
    titulo: string;
    dataTreino: string;
    descricao?: string;
  };

  if (!titulo || !dataTreino) {
    return res.status(400).json({ message: "Título e data são obrigatórios." });
  }

  const treino = await prisma.treinoAgendado.create({
    data: {
      titulo,
      atletaId,
      dataTreino: new Date(dataTreino),
      local: null,
      treinoProgramadoId: null, 
    },
  });

  return res.status(201).json(treino);
}

export async function agendarTreinoLote(req: AuthenticatedRequest, res: Response) {
  const user = req.user as any;

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

  const dt = new Date(dataTreino);

  await prisma.$transaction(
    atletasIds.map((atletaId) =>
      prisma.treinoAgendado.create({
        data: {
          titulo: "Treino programado",
          atletaId,
          treinoProgramadoId,
          dataTreino: dt,
        },
      })
    )
  );

  return res.status(201).json({ ok: true });
}

/* ===================== Helpers ===================== */
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
    if (m) return `Sub${m[1]}`;
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

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

/* ===================== Endpoints ===================== */
export async function treinosDisponiveis(_req: AuthenticatedRequest, res: Response) {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: { exercicios: { include: { exercicio: true, exercicioTemporario: true } } },
    });

    const resposta = treinos.map((t) => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      nivel: t.nivel,
      duracao: t.duracao,
      objetivo: t.objetivo,
      dicas: t.dicas,
      pontuacao: t.pontuacao ?? null,
      exercicios: t.exercicios.map((e) => ({
        id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
        nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
        repeticoes: e.repeticoes,
      })),
    }));

    res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos disponíveis:", error);
    res.status(500).json({ message: "Erro ao buscar treinos disponíveis", error });
  }
}

export async function salvarTreinoNaBiblioteca(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user as any;
    const usuarioId = req.userId!;
    const { treinoProgramadoId } = req.body as { treinoProgramadoId?: string };

    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    if (!treinoProgramadoId) {
      return res.status(400).json({ message: "treinoProgramadoId é obrigatório." });
    }

    // id do atleta vinculado ao usuário (conceito de “Biblioteca do Atleta”)
    const atletaId = user?.tipoUsuarioId as string | undefined;
    const plano = user?.plano ?? "FREE";

    if (!atletaId) {
      return res.status(400).json({ message: "atletaId não encontrado para o usuário logado." });
    }

    // garante que o treino existe (e pega dados pra montar titulo/conteudo)
    const treinoProgramado = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: { nome: true, descricao: true },
    });

    if (!treinoProgramado) {
      return res.status(404).json({ message: "Treino programado não encontrado." });
    }

    // 🔒 limite de treinos salvos no plano Free
    await enforceFeatureLimit({
      prisma,
      feature: "TREINO_SALVO",
      atletaId,
      usuarioId,
      plano,
    });

    // Evitar duplicar o mesmo treino salvo para o mesmo usuário
    const existente = await prisma.treinoSalvo.findFirst({
      where: { usuarioId, treinoProgramadoId },
    });

    if (existente) {
      return res.status(409).json({ message: "Esse treino já está na sua biblioteca." });
    }

    // 🔴 AQUI: preencher todos os campos obrigatórios do modelo TreinoSalvo
    const salvo = await prisma.treinoSalvo.create({
      data: {
        usuarioId,
        treinoProgramadoId,
        titulo: treinoProgramado.nome ?? "Treino salvo",
        conteudo: treinoProgramado.descricao ?? "Treino salvo na sua biblioteca.",
        // se o teu modelo tiver mais campos obrigatórios, coloca valores padrão aqui
        // exemplo:
        // tipoMidia: "Documento",
        // imagemUrl: null,
        // videoUrl: null,
      },
    });

    return res.status(201).json(salvo);
  } catch (err: any) {
    if (err?.code === "LIMIT_REACHED") {
      return res.status(err.status || 403).json({
        code: err.code,
        feature: err.feature,
        limit: err.limit,
        message: err.message,
      });
    }

    console.error("salvarTreinoNaBiblioteca", err);
    return res.status(500).json({ message: "Erro ao salvar treino na biblioteca." });
  }
}

export async function listarTodosTreinosProgramados(req: AuthenticatedRequest, res: Response) {
  try {
    const { professorId, clubeId, escolinhaId } = (req.query ?? {}) as Record<
      string,
      string | undefined
    >;
    const where: any = {};
    const or: any[] = [];
    if (professorId) or.push({ professorId: String(professorId) });
    if (clubeId) or.push({ clubeId: String(clubeId) });
    if (escolinhaId) or.push({ escolinhaId: String(escolinhaId) });
    if (or.length) where.OR = or;

    const rows = await prisma.treinoProgramado.findMany({
      where,
      include: {
        exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        professor: { select: { nome: true } },
        clube: { select: { nome: true } },
        escolinha: { select: { nome: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const out = rows.map((t) => ({
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
      exercicios: t.exercicios.map((x) => ({
        repeticoes: x.repeticoes ?? "",
        exercicio: { nome: x.exercicio?.nome ?? x.exercicioTemporario?.nome ?? "" },
      })),
      professor: t.professor ? { nome: t.professor.nome } : null,
      clube: t.clube ? { nome: t.clube.nome } : null,
      escolinha: t.escolinha ? { nome: t.escolinha.nome } : null,
      professorId: t.professorId ?? null,
      clubeId: t.clubeId ?? null,
      escolinhaId: t.escolinhaId ?? null,
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar treinos programados" });
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
      select: { id: true },
    });
    if (!atleta) return res.status(404).json({ message: "Atleta não encontrado." });
    const atletaId = atleta.id;

    const tp = await prisma.treinoProgramado.findUnique({ where: { id: treinoProgramadoId } });
    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

    const tituloFinal = titulo && titulo.trim() ? titulo : tp.nome ?? "Treino";
    const quandoBase = new Date(dataTreino);
    const exp = dataExpiracao
      ? new Date(dataExpiracao)
      : new Date(quandoBase.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (
      req.user?.tipo === "Professor" ||
      req.user?.tipo === "Clube" ||
      req.user?.tipo === "Escolinha"
    ) {
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
          return res
            .status(403)
            .json({ message: "Você não possui vínculo nem observação com este atleta." });
        }
      }
    }

    const existente = await prisma.treinoAgendado.findFirst({
      where: { atletaId, treinoProgramadoId },
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
          data: { titulo: tituloFinal, dataTreino: quandoBase, dataExpiracao: exp },
        });

        await audit(req, {
          acao: "ALTERAR_AGENDA",
          entidade: "TreinoAgendado",
          entidadeId: atualizado.id,
          descricao: "Agendamento remarcado",
          meta: { atletaId, dataTreino: atualizado.dataTreino, status: "Agendado" },
        });

        return res.status(200).json(atualizado);
      }
    }

    try {
      const criado = await prisma.treinoAgendado.create({
        data: {
          titulo: tituloFinal,
          atletaId,
          treinoProgramadoId,
          dataTreino: quandoBase,
          dataExpiracao: exp,
          criadoPorProfessorId: req.user?.tipo === "Professor" ? req.user.tipoUsuarioId : null,
        },
      });

      await audit(req, {
        acao: "ALTERAR_AGENDA",
        entidade: "TreinoAgendado",
        entidadeId: criado.id,
        descricao: "Agendamento criado",
        meta: { atletaId, dataTreino: criado.dataTreino, status: "Agendado" },
      });

      return res.status(201).json(criado);
    } catch (e: any) {
      if (e.code === "P2002") {
        const ex = await prisma.treinoAgendado.findFirst({
          where: { atletaId, treinoProgramadoId },
        });
        if (ex) return res.status(200).json(ex);

        const bump = new Date(quandoBase.getTime() + 1000);
        const criado2 = await prisma.treinoAgendado.create({
          data: {
            titulo: tituloFinal,
            atletaId,
            treinoProgramadoId,
            dataTreino: bump,
            dataExpiracao: exp,
            criadoPorProfessorId: req.user?.tipo === "Professor" ? req.user.tipoUsuarioId : null,
          },
        });

        await audit(req, {
          acao: "ALTERAR_AGENDA",
          entidade: "TreinoAgendado",
          entidadeId: criado2.id,
          descricao: "Agendamento criado (ajustado)",
          meta: { atletaId, dataTreino: criado2.dataTreino, status: "Agendado" },
        });

        return res.status(201).json(criado2);
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
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

export async function getTreinosAgendados(req: AuthenticatedRequest, res: Response) {
  try {
    const atletaIdQuery = typeof req.query.atletaId === "string" ? req.query.atletaId.trim() : "";
    const apenasFuturos = String(req.query.apenasFuturos || "") === "1";

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
    ].filter(Boolean) as any[];

    const where: any = { atletaId };
    if (donoOr.length) {
      where.OR = [{ treinoProgramadoId: null }, { treinoProgramado: { is: { OR: donoOr } } }];
    }

    const rows = await prisma.treinoAgendado.findMany({
      where: {
        ...where,
        OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }],
      },
      include: {
        treinoProgramado: {
          include: {
            exercicios: { include: { exercicio: true, exercicioTemporario: true } },
          },
        },
      },
      orderBy: { dataTreino: "asc" },
    });

    // ids dos agendados e status do usuário logado
    const agIds = rows.map((r) => r.id);
    const tuRows = await prisma.treinoUsuario.findMany({
      where: { treinoId: { in: agIds }, usuarioId: req.userId! },
      select: { treinoId: true, status: true, startedAt: true, completedAt: true },
    });
    const tuMap = new Map(tuRows.map((r) => [r.treinoId, r]));

    // submissões por agendado (filtradas pelo atleta)
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

    const now = new Date();

    const normalizados = rows.map((r) => {
      const tu = tuMap.get(r.id);
      const sub = subMap.get(r.id) ?? { enviados: 0, aprovados: 0 };

// ✅ "COMPLETED" somente quando existir submissão APROVADA daquele treino *agendado*
const enviados = sub.enviados ?? 0;
const aprovados = sub.aprovados ?? 0;

let meu: TreinoStatus = "PENDING";
if (aprovados > 0) {
  meu = TreinoStatus.COMPLETED;
} else if (tu?.status) {
  meu = tu.status as TreinoStatus;
} else if (r.dataExpiracao && r.dataExpiracao < now) {
  meu = TreinoStatus.EXPIRED;
}


      return {
        ...r,
        treinoProgramado: r.treinoProgramado
          ? {
              ...r.treinoProgramado,
              exercicios: r.treinoProgramado.exercicios.map((e) => ({
                repeticoes: e.repeticoes ?? "",
                exercicio: {
                  id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
                  nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
                },
              })),
            }
          : null,
        // ✅ campos padronizados para o front:
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

    if (!apenasFuturos) return res.json(normalizados);

    const hoje = startOfToday();
    const filtrados = normalizados.filter((r: any) => {
      const okDataTreino = r.dataTreino && r.dataTreino >= hoje;
      return okDataTreino || !r.dataTreino;
    });

    return res.json(filtrados);
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

    // escala vem como Json, convertemos para um map simples posicao -> atletaId
    const escala =
      (elenco.escala as Record<string, string | null> | null) ?? null;

    // formação também Json, { defesa, meio, atacantes }
    const formacao =
      (elenco.formacao as
        | { defesa: number; meio: number; atacantes: number }
        | null) ?? null;

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,   // ex: { GOL: "uuidAtleta", LD: "uuidAtleta", ... }
      formacao, // ex: { defesa: 4, meio: 2, atacantes: 3 }
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

    // usa o mesmo core para montar resposta (inclui escala + formacao)
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

    // turmaId AGORA É OPCIONAL
    const turmaIdFinal =
      typeof turmaId === "string" && turmaId.trim().length > 0
        ? turmaId.trim()
        : null;

    const dataCreate: any = {
      nome,
      maxJogadores,
      ativo,
      turmaId: turmaIdFinal, // pode ser null sem problema
    };

    if (tipoUsuario === "professor") dataCreate.professorId = tipoUsuarioId;
    if (tipoUsuario === "escolinha") dataCreate.escolinhaId = tipoUsuarioId;
    if (tipoUsuario === "clube") dataCreate.clubeId = tipoUsuarioId;

    const elenco = await prisma.elenco.create({ data: dataCreate });

    // Monta vínculos a partir de atletas[] ou escala
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

  const row = await prisma.treinoAgendado.update({
    where: { id },
    data: { dataTreino: dataTreino ? new Date(dataTreino) : null },
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

    // turmaId OPCIONAL no update também
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

    // zera vínculos antigos e recria
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
    let professorId: string | undefined =
      (typeof req.query.professorId === "string" && req.query.professorId.trim()) ||
      (typeof req.query.tipoUsuarioId === "string" && req.query.tipoUsuarioId.trim()) ||
      undefined;

    const usuarioIdQ =
      typeof req.query.usuarioId === "string" ? req.query.usuarioId.trim() : undefined;

    if (!professorId && usuarioIdQ) {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: usuarioIdQ },
        select: { id: true },
      });
      professorId = prof?.id;
    }

    if (!professorId) {
      res.json([]);
      return;
    }
    const pid: string = professorId;
    const incluirPontuacao = String(req.query.incluirPontuacao ?? "") === "1";

    const rows = await prisma.relacaoTreinamento.findMany({
      where: { professorId: pid, atletaId: { not: null } },
      select: {
        atleta: {
          select: {
            id: true,
            usuarioId: true,
            posicao: true,
            idade: true,
            categoria: true,
            usuario: { select: { nome: true, foto: true} },
            ...(incluirPontuacao
              ? { pontuacao: { select: { pontuacaoTotal: true } } }
              : {}),
          },
        },
      },
    });

    const lista = rows
      .map((r: typeof rows[number]) => r.atleta)
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({
        id: a.id,
        usuarioId: a.usuarioId,
        atletaId: a.id,
        nome: a.usuario?.nome ?? "Atleta",
        foto: a.usuario?.foto ?? null,
        posicao: a.posicao ?? null,
        idade: a.idade ?? null,
        categoria: Array.isArray(a.categoria) && a.categoria.length ? a.categoria[0] : null,
        pontuacao: (a as any).pontuacao?.pontuacaoTotal ?? null,
      }));

    res.json(lista);
  } catch (e) {
    console.error("GET /treinos/atletas-vinculados erro:", e);
    res.status(500).json({ error: "Falha ao buscar atletas vinculados" });
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
        nivel: "Base",
        tipoTreino: "Fisico",
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

export async function criarTreinoProgramado(req: AuthenticatedRequest, res: Response) {
  const user = req.user as any;
  
  if (!user || !can(user, "Treinos:CriarProgramado" as CanKey)) {
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

    if (user.tipo === "Professor" && !can(user, FEAT.TREINOS_ILIMITADOS)) {
      const profId = String(tipoUsuarioId);
      const ativos = await prisma.treinoProgramado.count({
        where: { professorId: profId, NOT: [{ naoExpira: true }] },
      });

      const limAtivos = planLimitFor(user.plano ?? "FREE", "planos_ativos_total");
      if (ativos >= limAtivos) {
        return res.status(402).json({
          code: "UPGRADE_REQUIRED",
          message: "Você atingiu o limite de planos/rotinas ativos para o seu plano.",
        });
      }
    }

    if (user.tipo === "Professor" && !can(user, FEAT.ROTINAS_ILIMITADAS)) {
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
    
    if (!nome || !nivel || !Array.isArray(exercicios) || !usuarioId || !tipoUsuarioId) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    let categorias: Categoria[] = [];
    try {
      categorias = normalizeCategorias(categoria);
    } catch {
      return res.status(400).json({ error: "Categoria(s) inválida(s)" });
    }

    const tipoTreinoNorm = normalizeTipoTreino(tipoTreino);
    if (tipoTreino && !tipoTreinoNorm) {
      return res.status(400).json({ error: "TipoTreino inválido" });
    }

    const when = dataTreino || dataAgendada || null;
    const tipoNorm = typeof tipoUsuario === "string" ? (tipoUsuario as string).toLowerCase() : null;

    const pontuacaoNum =
      Number.isFinite(Number(pontuacao)) ? Math.max(0, Math.floor(Number(pontuacao))) : null;

    const treino = await prisma.treinoProgramado.create({
      data: {
        nome,
        descricao,
        nivel,
        codigo: `${nome}-${Date.now()}`,
        dataAgendada: when ? new Date(when) : undefined,
        objetivo,
        duracao,
        dicas,
        categoria: categorias,
        tipoTreino: tipoTreinoNorm,
        pontuacao: pontuacaoNum ?? undefined,
        ...(tipoNorm === "professor"
          ? { professorId: tipoUsuarioId }
          : tipoNorm === "escolinha"
          ? { escolinhaId: tipoUsuarioId }
          : tipoNorm === "clube"
          ? { clubeId: tipoUsuarioId }
          : {}),
      },
    });

    const exsBanco = (exercicios as any[]).filter((e) => e.exercicioId);
    const exsTemp = (exercicios as any[]).filter((e) => !e.exercicioId && e.nome);

    const atletasFromElencos = elencosIds.length
      ? await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencosIds } },
          select: { atletaId: true },
        })
      : [];

    const atletasUniqRaw = Array.from(
      new Set([...(atletasIds || []), ...atletasFromElencos.map((a) => a.atletaId)])
    );

    const atletasResolvidos = atletasUniqRaw.length
      ? await prisma.atleta.findMany({
          where: {
            OR: [{ id: { in: atletasUniqRaw } }, { usuarioId: { in: atletasUniqRaw } }],
          },
          select: { id: true },
        })
      : [];

    const atletaIdsResolved: string[] = Array.from(new Set(atletasResolvidos.map((a) => a.id)));

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
      const temp = await prisma.exercicioTemporario.create({
        data: {
          treinoProgramadoId: treino.id,
          codigo: null,
          nome: e.nome,
          descricao: e.descricao ?? null,
          nivel,
          categorias,
        },
      });

      await prisma.treinoProgramadoExercicio.create({
        data: {
          treinoProgramadoId: treino.id,
          exercicioTemporarioId: temp.id,
          repeticoes: String(e.repeticoes ?? ""),
          ordem: e.ordem ?? exsBanco.length + i + 1,
        },
      });
    }

    if (atletaIdsResolved.length > 0) {
      const whenDate = treino.dataAgendada ?? new Date();
      await prisma.treinoAgendado.createMany({
        data: atletaIdsResolved.map((atletaId) => ({
          titulo: treino.nome,
          dataExpiracao: whenDate ? new Date(whenDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null,
          dataTreino: whenDate,
          atletaId,
          treinoProgramadoId: treino.id,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json(treino);
  } catch (err) {
    console.error("Erro ao criar treino:", err);
    return res.status(500).json({ error: "Erro ao criar treino" });
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
      const arr = Array.isArray(categoria) ? categoria : [categoria];
      const norm = arr.map((c: any) => String(c).trim());
      const valid = norm.filter((c: any) => (Object.values(Categoria) as string[]).includes(c));
      if (valid.length !== norm.length) {
        return res.status(400).json({ message: "Categoria(s) inválida(s)" });
      }
      categoriasNorm = valid as Categoria[];
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
      await tx.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.exercicioTemporario.deleteMany({ where: { treinoProgramadoId: id } });

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
            ? { dataAgendada: dataAgendada ? new Date(dataAgendada) : null }
            : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(duracao !== undefined ? { duracao: duracao != null ? Number(duracao) : null } : {}),
          ...(dicas !== undefined ? { dicas: Array.isArray(dicas) ? dicas : [] } : {}),
          ...(imagemUrl !== undefined ? { imagemUrl } : {}),
          ...(metas !== undefined ? { metas } : {}),
          ...(pontuacao !== undefined
            ? { pontuacao: pontuacao != null ? Number(pontuacao) : null }
            : {}),
          ...(expiraEm !== undefined ? { expiraEm: expiraEm ? new Date(expiraEm) : null } : {}),
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
        const temp = await tx.exercicioTemporario.create({
          data: {
            treinoProgramadoId: id,
            codigo: null,
            nome: e.nome,
            descricao: e.descricao ?? null,
            nivel: nivel !== undefined ? nivel : "Base",
            categorias: categoriasNorm ?? [],
          },
        });

        await tx.treinoProgramadoExercicio.create({
          data: {
            treinoProgramadoId: id,
            exercicioTemporarioId: temp.id,
            repeticoes: String(e.repeticoes ?? ""),
            ordem: e.ordem ?? exsBanco.length + i + 1,
          },
        });

      }
    });

    const updated = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        professor: { select: { nome: true } },
        clube: { select: { nome: true } },
        escolinha: { select: { nome: true } },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Erro em atualizarTreinoProgramado:", err);
    return res.status(500).json({ message: "Erro ao atualizar treino" });
  }
}

export const deletarTreinoProgramado = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.treinoAgendado.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.exercicioTemporario.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.treinoProgramado.delete({ where: { id } });
    });
    return res.status(200).json({ message: "Treino excluído." });
  } catch (e: any) {
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
                pontuacao: true,
                nome: true,
                tipoTreino: true,
                duracao: true,
                professorId: true,
                clubeId: true,
                escolinhaId: true,
              },
            },
          },
        },
      },
    });
    if (!sub) return res.status(404).json({ message: "Submissão não encontrada" });

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

    const donoTreino =
      !!sub.treinoAgendado?.treinoProgramado &&
      (sub.treinoAgendado.treinoProgramado.professorId === resolved.id ||
        sub.treinoAgendado.treinoProgramado.clubeId === resolved.id ||
        sub.treinoAgendado.treinoProgramado.escolinhaId === resolved.id);

    if (!vinculo && !donoTreino) {
      return res
        .status(403)
        .json({ message: "Você não possui vínculo/direito para validar esta submissão." });
    }

    if (sub.aprovado === true) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
      } catch (e) {
        console.warn("stats (feito por aluno) pós-conclusão auto-aprovada falhou:", e);
      }
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

    if (aprovado === true) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
      } catch (e) {
        console.warn("stats (feito por aluno) na aprovação falhou:", e);
      }
    }

    try {
      await recomputePontuacaoAtleta(sub.atletaId);
    } catch (e) {
      console.warn("recomputePontuacaoAtleta falhou (não é crítico para a aprovação):", e);
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
    // o front chama com atletaId, tipoUsuarioId e às vezes usuarioId
    const qAtletaId = String((req.query.atletaId ?? req.query.tipoUsuarioId ?? "") as string).trim();
    const qUsuarioId = String((req.query.usuarioId ?? "") as string).trim();

    let atletaId = qAtletaId;

    // 1) se não veio atletaId, tenta descobrir pelo usuarioId passado na query
    if (!atletaId && qUsuarioId) {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId: qUsuarioId },
        select: { id: true },
      });
      atletaId = atleta?.id ?? "";
    }

    // 2) se ainda não tiver, tenta pelo usuário logado (token)
    if (!atletaId && req.userId) {
      const u = await prisma.usuario.findUnique({
        where: { id: req.userId },
        include: { atleta: true },
      });
      atletaId = u?.atleta?.id ?? "";
    }

    if (!atletaId) {
      // sem atleta => sem submissões
      return res.json([]);
    }

    const subs = await prisma.submissaoTreino.findMany({
      where: {
        atletaId,
        // não precisa do "not: null" porque treinoAgendadoId é String obrigatória
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
      // aqui é o ID específico do treino AGENDADO (é o que o front usa pra marcar como feito)
      treinoAgendadoId: s.treinoAgendadoId,
      // e aqui só para referência (se você quiser usar em outra tela)
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
        end.setDate(end.getDate() + 7);
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

export async function listarAtletasVinculados(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;

    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId obrigatório" });
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
      const usuarioIds = membros.map(m => m.usuarioId);

      whereBase.usuarioId = { in: usuarioIds.length ? usuarioIds : ["__none__"] };
    }

    const atletas = await prisma.atleta.findMany({
      where: whereBase,
      select: {
        id: true, usuarioId: true, nome: true, foto: true, idade: true, posicao: true,
      },
      orderBy: { nome: "asc" },
    });

    return res.json(atletas);
  } catch (e) {
    console.error("[listarAtletasVinculados]", e);
    return res.status(500).json({ error: "Erro ao listar atletas vinculados" });
  }
}

export async function listarAgendados(req: Request, res: Response) {
  try {
    const atletaId = String(req.query.atletaId);
    const apenasFuturos = String(req.query.apenasFuturos || "1") === "1";

    if (!atletaId) return res.status(400).json({ message: "atletaId obrigatório" });

    const where: any = { atletaId };
    if (apenasFuturos) where.dataTreino = { gte: startOfToday() };

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

     if (!can(req.user as any, FEAT.AGENDAMENTO_LOTE)) {
      return res.status(402).json({
        code: "UPGRADE_REQUIRED",
        message: "Recurso disponível apenas em planos superiores (agendamento em lote).",
      });
    }

    if (!treinoProgramadoId || !Array.isArray(datas) || datas.length === 0) {
      return res.status(400).json({ message: "Informe treinoProgramadoId e ao menos uma data." });
    }

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: String(treinoProgramadoId) },
    });
    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

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
      return res.status(400).json({ message: "Nenhum atleta resolvido para receber a rotina." });
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
      const fimMes    = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

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

    const payload: Prisma.TreinoAgendadoCreateManyInput[] = [];

    for (const d of datas) {
      const diaISO = String(d).trim();
      if (!diaISO) continue;

      const dataTreino = /T/.test(diaISO) ? new Date(diaISO) : new Date(`${diaISO}T23:59:59.000Z`);
      const dataExpiracao = new Date(dataTreino.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const atletaId of atletaIdsFinal) {
        payload.push({
          titulo: tp.nome,
          atletaId,
          treinoProgramadoId: tp.id,
          dataTreino,
          dataExpiracao,
          criadoPorProfessorId: req.user?.tipo === "Professor" ? req.user.tipoUsuarioId : null,
        });
      }
    }

    if (!payload.length)
      return res.status(400).json({ message: "Nenhuma combinação válida de atleta/data." });

    let criados = 0;
    const chunkSize = 500;

    for (let i = 0; i < payload.length; i += chunkSize) {
      const slice = payload.slice(i, i + chunkSize);
      const r = await prisma.treinoAgendado.createMany({
        data: slice,
        skipDuplicates: true,
      });
      criados += r.count;
    }
    return res.status(201).json({
      ok: true,
      atletas: atletaIdsFinal.length,
      datas: datas.length,
      criados,
      fairUse: fairUseInfo,
    });
  } catch (e) {
    console.error("agendarRotinaMensal", e);
    return res.status(500).json({ message: "Erro ao agendar rotina." });
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
    const { id } = req.params;                // id do TreinoAgendado
    const usuarioId = req.userId!;            // usuário logado (atleta)
    const atletaId = req.user?.tipoUsuarioId; // id do Atleta

    if (!atletaId || req.user?.tipo !== "Atleta") {
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

    // Se já foi iniciado antes, só devolve o estado atual
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
    const { id } = req.params; // id do TreinoAgendado
    const usuarioId = req.userId!;
    const atletaId = req.user?.tipoUsuarioId;

    const { observacao, midiaUrl, midiaTipo } = req.body as {
      observacao?: string;
      midiaUrl?: string;
      midiaTipo?: TipoMidia | string;
    };

    if (!atletaId || req.user?.tipo !== "Atleta") {
      return res.status(403).json({ message: "Apenas atleta pode finalizar o treino." });
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

    // Normalizar midiaTipo vindo como string
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
      // default: se tem mídia mas não mandou tipo, considera vídeo
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