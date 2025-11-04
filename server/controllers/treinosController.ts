import { Response, Request } from "express";
import { PrismaClient, PosicaoCampo, Categoria, TipoTreino, TreinoStatus } from "@prisma/client";
import { getIO } from "../socket.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";
import { sanitizeText, basicModerationFails } from "../utils/moderation.js";
import { onTreinoUsadoPorProfessor, onExercicioIncluidoNoTreino, onTreinoFeitoPorAlunoFromSubmissao } from "../services/statsService.js";

const prisma = new PrismaClient();

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
  if (valid.length !== mapped.length) {
    throw new Error("Categoria(s) inválida(s)");
  }
  return valid as Categoria[];
}

function normalizeTipoTreino(input: any): TipoTreino | undefined {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (s === "fisico" || s === "físico") return "Fisico";
  if (s === "tecnico" || s === "técnico") return "Tecnico";
  if (s === "tatico" || s === "tático") return "Tatico";
  if (s === "mental") return "Mental";
  return (Object.values(TipoTreino) as string[]).includes(String(input)) ? (input as TipoTreino) : undefined;
}

async function notificarNovoTreino(deUsuarioId: string, atletaId: string, treinoId: string, titulo: string) {
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
    io.to(deUsuarioId).emit("novaMensagem", { ...saved, pending: false });
  }
}

async function resolveEntidade(usuarioOuEntidadeId: string): Promise<
  | { tipo: "professor"; id: string }
  | { tipo: "clube"; id: string }
  | { tipo: "escolinha"; id: string }
  | null
> {
  const [prof, clube, escola] = await Promise.all([
    prisma.professor.findFirst({ where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] }, select: { id: true } }),
    prisma.clube.findFirst({ where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] }, select: { id: true } }),
    prisma.escolinha.findFirst({ where: { OR: [{ id: usuarioOuEntidadeId }, { usuarioId: usuarioOuEntidadeId }] }, select: { id: true } }),
  ]);
  if (prof)   return { tipo: "professor", id: prof.id };
  if (clube)  return { tipo: "clube", id: clube.id };
  if (escola) return { tipo: "escolinha", id: escola.id };
  return null;
}

export async function treinosDisponiveis(_req: AuthenticatedRequest, res: Response) {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: { exercicios: { include: { exercicio: true, exercicioTemporario: true } } },
    });

    const resposta = treinos.map(t => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      nivel: t.nivel,
      duracao: t.duracao,
      objetivo: t.objetivo,
      dicas: t.dicas,
      pontuacao: t.pontuacao ?? null,
      exercicios: t.exercicios.map(e => ({
        id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
        nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
        repeticoes: e.repeticoes
      }))
    }));

    res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos disponíveis:", error);
    res.status(500).json({ message: "Erro ao buscar treinos disponíveis", error });
  }
}

export async function listarTodosTreinosProgramados(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await prisma.treinoProgramado.findMany({
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
      exercicios: treino.exercicios.map(e => ({
        repeticoes: e.repeticoes,
        exercicio: {
          id: e.exercicio?.id ?? e.exercicioTemporario?.id ?? "",
          nome: e.exercicio?.nome ?? e.exercicioTemporario?.nome ?? "",
        }
      }))
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
      treinoProgramadoId,
      dataTreino,
      dataExpiracao,
      titulo,
      atletaId: atletaIdBody,
      tipoUsuarioId,
    } = req.body as {
      treinoProgramadoId: string;
      dataTreino: string;
      dataExpiracao?: string | null;
      titulo?: string | null;
      atletaId?: string | null;
      tipoUsuarioId?: string | null;
    };

    const deUsuarioId = req.userId!;
    const atletaId = atletaIdBody || tipoUsuarioId;
    if (!treinoProgramadoId || !atletaId || !dataTreino) {
      return res.status(400).json({ message: "Dados incompletos." });
    }

    const tp = await prisma.treinoProgramado.findUnique({ where: { id: treinoProgramadoId } });
    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

    const tituloFinal = (typeof titulo === "string" && titulo.trim()) ? titulo : (tp.nome ?? "Treino");
    const atletaIdStr = String(atletaId);  
    const dataTreinoDate = new Date(dataTreino);

    const criado = await prisma.treinoAgendado.create({
      data: {
        titulo: tituloFinal,      
        atletaId: atletaIdStr,    
        treinoProgramadoId,
        dataTreino: dataTreinoDate,  
        criadoPorProfessorId: req.user?.tipo === "Professor" ? req.user.tipoUsuarioId : null,
      },
    });

    if (criado.treinoProgramadoId) {
      await onTreinoUsadoPorProfessor({
        treinoId: criado.treinoProgramadoId,
        professorId: req.user?.tipo === "Professor" ? req.user.tipoUsuarioId : undefined,
      });
    }

    await notificarNovoTreino(deUsuarioId, atletaIdStr, criado.id, tituloFinal);

    return res.status(201).json(criado);
  } catch (error) {
    console.error("Erro ao agendar treino:", error);
    return res.status(500).json({ message: "Erro ao agendar treino." });
  }
}

export const excluirTreinoAgendado = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.treinoAgendado.deleteMany({ where: { id } });
    res.status(200).json({ message: "Treino agendado deletado (ou já estava deletado)." });
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

  return { atletaId: atleta.id, clubes: [...clubes], escolinhas: [...escolinhas], professores: [...professores] };
}

export async function getTreinosAgendados(req: AuthenticatedRequest, res: Response) {
  const atletaUsuarioId = String(req.query.usuarioId || req.userId || "");
  if (!atletaUsuarioId) return res.status(400).json({ error: "usuarioId ausente" });

  const vinc = await idsInstituicoesAtuais(prisma, atletaUsuarioId);
  if (!vinc.atletaId) return res.json([]);

  const donoOr = [
    vinc.clubes.length ? { clubeId: { in: vinc.clubes } } : undefined,
    vinc.escolinhas.length ? { escolinhaId: { in: vinc.escolinhas } } : undefined,
    vinc.professores.length ? { professorId: { in: vinc.professores } } : undefined,
  ].filter(Boolean) as any[];

  const where: any = { atletaId: vinc.atletaId };
  if (donoOr.length) {
    where.OR = [{ treinoProgramadoId: null }, { treinoProgramado: { OR: donoOr } }];
  }
  const rows = await prisma.treinoAgendado.findMany({
    where,
    include: {
      treinoProgramado: {
        include: {
          exercicios: { include: { exercicio: true, exercicioTemporario: true } },
        },
      },
    },
  });

  res.json(rows);
}

export async function concluirTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId!;
    const treinoAgendadoId = String((req.body?.treinoAgendadoId ?? req.params?.id) || "");
    let { atletaId, pontos, tempoSeg, repeticoes, duracaoMinutos } = (req.body ?? {}) as {
      atletaId?: string; pontos?: number; tempoSeg?: number; repeticoes?: number; duracaoMinutos?: number;
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
        treinoProgramado: { select: { pontuacao: true, duracao: true, tipoTreino: true, nome: true } },
      },
    });
    if (!agendado) return res.status(404).json({ error: "Treino agendado não encontrado" });
    if (agendado.atleta?.usuarioId !== usuarioId) {
      return res.status(403).json({ error: "Você não pode concluir este treino" });
    }

    const titulo = agendado.treinoProgramado?.nome ?? agendado.titulo ?? "Treino";

    const conteudo = `🏅 Concluí o treino: ${titulo}${
      Number.isFinite(Number(repeticoes)) ? ` — ${repeticoes} rep.` : ""
    }${Number.isFinite(Number(tempoSeg)) ? ` — ${Math.round(Number(tempoSeg))}s` : ""}`;

    const post = await prisma.postagem.create({
      data: { usuarioId, conteudo, tipoMidia: "Documento" as any, imagemUrl: null, videoUrl: null },
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
    getIO()?.to([`u:${usuarioId}`, ...segs.map(s => `u:${s.seguidorUsuarioId}`)]).emit("feed:novoPost", post);

    const pontosTemplate = typeof pontos === "number" && pontos >= 0 ? pontos : (agendado.treinoProgramado?.pontuacao ?? 0);

    const obs = req.body?.observacao ? sanitizeText(req.body.observacao, 800) : null;
    if (obs) {
      const fail = basicModerationFails(obs);
      if (fail) return res.status(422).json({ message: fail });
    }

    const duracaoFinal =
      Number.isFinite(Number(duracaoMinutos)) ? Number(duracaoMinutos) : (agendado.treinoProgramado?.duracao ?? undefined);

    const temVinc = await atletaTemVinculo(atletaId);

    const existente = await prisma.submissaoTreino.findFirst({ where: { treinoAgendadoId, atletaId } });

    const dataCommon = {
      aprovado: (temVinc ? (null as any) : (true as any)),
      pontuacaoSnapshot: temVinc ? undefined : 0,
      pontosCreditados:  temVinc ? undefined : 0,
      duracaoMinutos: duracaoFinal,
      treinoTituloSnapshot: agendado.treinoProgramado?.nome ?? agendado.titulo ?? undefined,
      tipoTreinoSnapshot: agendado.treinoProgramado?.tipoTreino ?? undefined,
      tempoSeg: Number.isFinite(Number(tempoSeg)) ? Number(tempoSeg) : undefined,
      repeticoes: Number.isFinite(Number(repeticoes)) ? Number(repeticoes) : undefined,
      observacao: obs ?? undefined,
      sugestaoPontosTemplate: pontosTemplate > 0 ? pontosTemplate : undefined,
    } as any;

    const sub = existente
      ? await prisma.submissaoTreino.update({ where: { id: existente.id }, data: dataCommon })
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

    res.json({ ok: true, pontos: 0, submissao: sub, pendenteValidacao: temVinc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao concluir treino" });
  }
}

export async function iniciarTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const treinoAgendadoId = req.params.id;
    const usuarioId = req.userId!;

    const ag = await prisma.treinoAgendado.findUnique({ where: { id: treinoAgendadoId }, select: { atleta: { select: { usuarioId: true } } } });
    if (!ag) return res.status(404).json({ error: "Treino agendado não encontrado" });
    if (ag.atleta?.usuarioId !== usuarioId) return res.status(403).json({ error: "Você não pode iniciar este treino" });

    const started = await prisma.treinoUsuario.upsert({
      where: { treinoId_usuarioId: { treinoId: treinoAgendadoId, usuarioId } },
      create: { treinoId: treinoAgendadoId, usuarioId, status: TreinoStatus.IN_PROGRESS, startedAt: new Date() },
      update: { status: TreinoStatus.IN_PROGRESS, startedAt: new Date() },
    });

    res.json({ ok: true, started });
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
    const atletaIds = raw.split(",").map(s => s.trim()).filter(Boolean);
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

export async function getEscalaPorElencoId(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const elenco = await prisma.elenco.findUnique({ where: { id } });
    if (!elenco) return res.status(404).json({ error: "Elenco não encontrado" });

    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: id },
      include: { atleta: { include: { usuario: true } } },
    });

    const posicoes: PosicaoCampo[] = ["GOL","LD","ZD","ZE","LE","VOL1","VOL2","MEI","PD","CA","PE"];

    const escala = posicoes.reduce((acc, pos) => {
      acc[pos] = null as any;
      return acc;
    }, {} as Record<PosicaoCampo, {
      atletaId: string;
      usuarioId: string;
      nome: string;
      foto?: string | null;
      idade?: number | null;
      posicao?: string | null;
    } | null>);

    for (const v of vinculos) {
      const a = v.atleta;
      const u = a?.usuario;
      if (!u) continue;
      escala[v.posicao] = {
        atletaId: a.id,
        usuarioId: u.id,
        nome: u.nome,
        foto: u.foto,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
      };
    }

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,
      atletasCount: vinculos.length,
    });
  } catch (err) {
    console.error("Erro ao buscar escala do elenco:", err);
    return res.status(500).json({ error: "Erro ao buscar escala do elenco" });
  }
}

export async function getEscalaPorDono(req: Request, res: Response) {
  try {
    const raw = (req.query.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw).trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

    const elenco = await prisma.elenco.findFirst({
      where: {
        ativo: true,
        OR: [{ professorId: tipoUsuarioId }, { escolinhaId: tipoUsuarioId }, { clubeId: tipoUsuarioId }],
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elenco) return res.json(null);

    req.params.id = elenco.id;
    return getEscalaPorElencoId(req, res);
  } catch (err) {
    console.error("Erro ao buscar escala por dono:", err);
    return res.status(500).json({ error: "Erro ao buscar escala por dono" });
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
      resolved.tipo === "professor" ? { professorId: resolved.id } :
      resolved.tipo === "clube"     ? { clubeId: resolved.id } :
                                      { escolinhaId: resolved.id };

    const rels = await prisma.relacaoTreinamento.findMany({
      where: { ...whereRel, atletaId: { not: null } },
      select: { atletaId: true },
    });
    rels.forEach(r => r.atletaId && atletaIds.add(r.atletaId));

    if (resolved.tipo === "clube") {
      const diretos = await prisma.atleta.findMany({ where: { clubeId: resolved.id }, select: { id: true } });
      diretos.forEach(a => atletaIds.add(a.id));
    }
    if (resolved.tipo === "escolinha") {
      const diretos = await prisma.atleta.findMany({ where: { escolinhaId: resolved.id }, select: { id: true } });
      diretos.forEach(a => atletaIds.add(a.id));
    }

    if (atletaIds.size === 0) {
      return res.json({ items: [], total: 0, limit: 0, offset: 0 });
    }

    const where: any = { atletaId: { in: Array.from(atletaIds) } };
    switch (status) {
      case "pendente":
        where.OR = [
          { aprovado: { equals: null } },
          { AND: [{ aprovado: false }, { OR: [{ pontosCreditados: null }, { pontosCreditados: 0 }] }] },
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
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0,   0);

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
          titulo: s.treinoAgendado?.titulo ?? s.treinoAgendado?.treinoProgramado?.nome ?? "Treino",
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
        OR: [{ professorId: tipoUsuarioId }, { escolinhaId: tipoUsuarioId }, { clubeId: tipoUsuarioId }],
        ativo: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elencos.length) return res.json([]);

    const elencoIds = elencos.map((e) => e.id);
    const vinculos = await prisma.atletaElenco.findMany({ where: { elencoId: { in: elencoIds } } });

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
    } = req.body as {
      nome?: string;
      maxJogadores?: number;
      tipoUsuario?: "professor" | "escolinha" | "clube";
      tipoUsuarioId?: string;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
      ativo?: boolean;
    };

    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    if (!tipoUsuario || !["professor", "escolinha", "clube"].includes(tipoUsuario)) {
      return res.status(400).json({ error: "tipoUsuario inválido" });
    }

    const dataCreate: any = { nome, maxJogadores, ativo };
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
        .map(([pos, atletaId]) => ({ posicao: pos as PosicaoCampo, atletaId: atletaId as string }));
    }

    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map((v) => ({ elencoId: elenco.id, atletaId: v.atletaId, posicao: v.posicao })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao criar elenco:", err);
    return res.status(500).json({ error: "Erro ao criar elenco" });
  }
}

export async function atualizarElenco(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { nome, maxJogadores, ativo, atletas, escala } = req.body as {
      nome?: string;
      maxJogadores?: number;
      ativo?: boolean;
      atletas?: { atletaId: string; posicao: PosicaoCampo }[];
      escala?: Record<PosicaoCampo, string | null>;
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

    const elenco = await prisma.elenco.update({ where: { id }, data: dataUpdate });

    let vinculos: { atletaId: string; posicao: PosicaoCampo }[] = [];
    if (Array.isArray(atletas) && atletas.length) {
      vinculos = atletas;
    } else if (escala && typeof escala === "object") {
      vinculos = Object.entries(escala)
        .filter(([, atletaId]) => !!atletaId)
        .map(([pos, atletaId]) => ({ posicao: pos as PosicaoCampo, atletaId: atletaId as string }));
    }

    await prisma.atletaElenco.deleteMany({ where: { elencoId: id } });
    if (vinculos.length) {
      await prisma.atletaElenco.createMany({
        data: vinculos.map(v => ({ elencoId: id, atletaId: v.atletaId, posicao: v.posicao })),
        skipDuplicates: true,
      });
    }

    const setNovos = new Set(vinculos.map(v => v.atletaId));
    const removidos = vinculadosAtuais.map(v => v.atletaId).filter(a => !setNovos.has(a));

    if (removidos.length) {
      await prisma.treinoAgendado.updateMany({
        where: {
          atletaId: { in: removidos },
          treinoProgramado: {
            OR: [
              dono.clubeId ? { clubeId: dono.clubeId } : undefined,
              dono.escolinhaId ? { escolinhaId: dono.escolinhaId } : undefined,
              dono.professorId ? { professorId: dono.professorId } : undefined,
            ].filter(Boolean) as any,
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

    const usuarioIdQ = typeof req.query.usuarioId === "string" ? req.query.usuarioId.trim() : undefined;

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
            usuario: { select: { nome: true, foto: true } },
            ...(incluirPontuacao ? { pontuacao: { select: { pontuacaoTotal: true } } } : {}),
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

export async function criarTreinoProgramado(req: Request, res: Response) {
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

    const elencos = elencosIds.length
      ? await prisma.elenco.findMany({
          where: { id: { in: elencosIds } },
          select: { atletasIds: true },
        })
      : [];

    const atletasFromTurmas = elencos.flatMap(e => e.atletasIds ?? []);
    const atletasUniqRaw = Array.from(
      new Set([ ...(atletasIds || []), ...atletasFromTurmas ])
    );

    const atletasResolvidos = atletasUniqRaw.length
      ? await prisma.atleta.findMany({
          where: {
            OR: [
              { id:        { in: atletasUniqRaw } },
              { usuarioId: { in: atletasUniqRaw } },
            ],
          },
          select: { id: true },
        })
      : [];

    const atletaIdsResolved: string[] = Array.from(
      new Set(atletasResolvidos.map(a => a.id))
    );

    if (exsBanco.length) {
      await prisma.treinoProgramadoExercicio.createMany({
        data: exsBanco.map((e, i) => ({
          treinoProgramadoId: treino.id,
          exercicioId: e.exercicioId,
          repeticoes: e.repeticoes ?? null,
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
          repeticoes: e.repeticoes ?? null,
          ordem: e.ordem ?? (exsBanco.length + i + 1),
        },
      });
    }

    if (atletaIdsResolved.length > 0) {
      const whenDate = treino.dataAgendada ?? new Date();
      await prisma.treinoAgendado.createMany({
        data: atletaIdsResolved.map((atletaId) => ({
          titulo: treino.nome,
          dataExpiracao: whenDate,
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
      nome, codigo, descricao, nivel, categoria, tipoTreino, dataAgendada, objetivo,
      duracao, dicas, imagemUrl, metas, pontuacao, expiraEm, naoExpira,
      exercicios = [],
      tipoUsuario, tipoUsuarioId,
    } = req.body as any;

    if (nome || codigo) {
      const dup = await prisma.treinoProgramado.findFirst({
        where: { id: { not: id }, OR: [{ nome: nome ?? "" }, { codigo: codigo ?? "" }] },
        select: { id: true, nome: true, codigo: true },
      });
      if (dup) {
        return res.status(400).json({ message: "Já existe treino com esse nome ou código.", duplicado: dup });
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

    const tipoTreinoNorm = tipoTreino !== undefined ? normalizeTipoTreino(tipoTreino) : undefined;
    if (tipoTreino !== undefined && !tipoTreinoNorm) {
      return res.status(400).json({ message: "TipoTreino inválido" });
    }

    const donoUpdate: any = {};
    if (tipoUsuario || tipoUsuarioId) {
      const s = String(tipoUsuario || "").toLowerCase();
      donoUpdate.professor = { disconnect: true };
      donoUpdate.clube = { disconnect: true };
      donoUpdate.escolinha = { disconnect: true };
      if (s === "professor") donoUpdate.professor  = { connect: { id: tipoUsuarioId } };
      if (s === "clube")     donoUpdate.clube      = { connect: { id: tipoUsuarioId } };
      if (s === "escolinha" || s === "escola") donoUpdate.escolinha = { connect: { id: tipoUsuarioId } };
    }

    const exs: any[] = Array.isArray(exercicios) ? exercicios : [];
    const exsBanco = exs.filter(e => e.exercicioId);
    const exsTemp  = exs.filter(e => !e.exercicioId && e.nome);

    const antigos = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId: id },
      select: { exercicioId: true },
    });
    const antigosSet = new Set(
      antigos.map(a => a.exercicioId).filter(Boolean) as string[]
    );

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
          ...(dataAgendada !== undefined ? { dataAgendada: dataAgendada ? new Date(dataAgendada) : null } : {}),
          ...(objetivo !== undefined ? { objetivo } : {}),
          ...(duracao !== undefined ? { duracao: duracao != null ? Number(duracao) : null } : {}),
          ...(dicas !== undefined ? { dicas: Array.isArray(dicas) ? dicas : [] } : {}),
          ...(imagemUrl !== undefined ? { imagemUrl } : {}),
          ...(metas !== undefined ? { metas } : {}),
          ...(pontuacao !== undefined ? { pontuacao: pontuacao != null ? Number(pontuacao) : null } : {}),
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
            repeticoes: e.repeticoes ?? null,
            ordem: e.ordem ?? i + 1,
          })),
        });
      }

      if (exsBanco.length) {
        const professorIdForStats =
          (typeof tipoUsuario === "string" && String(tipoUsuario).toLowerCase() === "professor")
            ? String(tipoUsuarioId)
            : undefined;

        const novosOficiais = (Array.isArray(exercicios) ? exercicios : [])
          .map((e: any) => e.exercicioId)
          .filter((id: any) => typeof id === "string" && id);

        const apenasNovos = novosOficiais.filter((id: string) => !antigosSet.has(id));

        if (apenasNovos.length) {
          const professorIdForStats =
            (typeof tipoUsuario === "string" && String(tipoUsuario).toLowerCase() === "professor")
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
            nivel: nivel,
            categorias: categoriasNorm ?? [],
          },
        });

        await tx.treinoProgramadoExercicio.create({
          data: {
            treinoProgramadoId: id,
            exercicioTemporarioId: temp.id,
            repeticoes: e.repeticoes ?? null,
            ordem: e.ordem ?? (exsBanco.length + i + 1),
          },
        });
      }
    });

    res.setHeader("X-TPR-Handler", "treinos.put.v2");
    return res.json({ ok: true, id, updated: true });
  } catch (error: any) {
    console.error("ERRO PUT /treinos/:id", error);
    return res.status(500).json({ message: "Erro ao atualizar treino.", error: error.message });
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
            treinoProgramado: { select: { pontuacao: true, nome: true, tipoTreino: true, duracao: true, professorId: true, clubeId: true, escolinhaId: true } },
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
        ...(resolved.tipo === "professor" ? { professorId: resolved.id } :
           resolved.tipo === "clube"     ? { clubeId: resolved.id } :
                                          { escolinhaId: resolved.id }),
      },
      select: { id: true },
    });

    const donoTreino = sub.treinoAgendado?.treinoProgramado && (
      sub.treinoAgendado.treinoProgramado.professorId === resolved.id ||
      sub.treinoAgendado.treinoProgramado.clubeId === resolved.id ||
      sub.treinoAgendado.treinoProgramado.escolinhaId === resolved.id
    );

    if (!vinculo && !donoTreino) {
      return res.status(403).json({ message: "Você não possui vínculo/direito para validar esta submissão." });
    }

    if (sub.aprovado === true) {
      try {
        await onTreinoFeitoPorAlunoFromSubmissao(sub.id);
      } catch (e) {
        console.warn("stats (feito por aluno) pós-conclusão auto-aprovada falhou:", e);
      }
    }

    const checklist = (req.body?.checklist ?? null) as {
      templateId: string,
      answers: { itemId: string; value: any; comment?: string }[]
    } | null;

    let pontosDoChecklist: number | null = null;

    if (checklist?.templateId && Array.isArray(checklist.answers)) {
      const existing = await prisma.submissionChecklist.findFirst({ where: { submissaoTreinoId: sub.id } });
      const chk = existing
        ? await prisma.submissionChecklist.update({ where: { id: existing.id }, data: { templateId: checklist.templateId } })
        : await prisma.submissionChecklist.create({ data: { templateId: checklist.templateId, context: "SUBMISSAO_TREINO", submissaoTreinoId: sub.id } });

      await prisma.checklistAnswer.deleteMany({ where: { checklistId: chk.id } });
      await prisma.checklistAnswer.createMany({
        data: checklist.answers.map(a => ({ checklistId: chk.id, itemId: a.itemId, value: a.value, comment: a.comment }))
      });

      const tpl = await prisma.checklistTemplate.findUnique({ where: { id: checklist.templateId }, include: { items: true } });
      if (tpl) {
        pontosDoChecklist = 0;
        for (const it of tpl.items) {
          const ans = checklist.answers.find(a => a.itemId === it.id)?.value || {};
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

    const treinoIdForKey =
      (sub as any).treinoAgendadoId || sub.treinoAgendado?.id || null;
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

    const pontosBase  = sub.pontuacaoSnapshot ?? sub.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    const pontosFinais = aprovado
      ? (Number.isFinite(Number(pontos)) ? Number(pontos) : (pontosDoChecklist ?? pontosBase ?? 0))
      : 0;

    const atualizado = await prisma.submissaoTreino.update({
      where: { id: sub.id },
      data: {
        aprovado,
        pontosCreditados: pontosFinais || null,
        pontuacaoSnapshot: pontosFinais || null,
        treinoTituloSnapshot: sub.treinoAgendado?.treinoProgramado?.nome ?? sub.treinoAgendado?.titulo ?? undefined,
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

    return res.json({ ok: true, aprovado, pontos: pontosFinais, id: atualizado.id });
  } catch (err) {
    console.error("Erro em validarSubmissaoTreino:", err);
    return res.status(500).json({ message: "Erro ao validar submissão" });
  }
}

export async function listarMinhasSubmissoesTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const qAtletaId = String((req.query.atletaId ?? "") as string).trim();

    let atletaId = qAtletaId;
    if (!atletaId) {
      const u = await prisma.usuario.findUnique({
        where: { id: req.userId! },
        include: { atleta: true },
      });
      atletaId = u?.atleta?.id ?? "";
    }

    if (!atletaId) {
      return res.json([]);
    }

    const subs = await prisma.submissaoTreino.findMany({
      where: { atletaId },
      select: {
        id: true,
        aprovado: true,
        treinoAgendadoId: true,
        treinoAgendado: { select: { treinoProgramadoId: true } },
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
    const windows: { start: Date; end: Date; index: number }[] = Array.from({ length: 4 }, (_, i) => {
      const start = new Date(w0);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end, index: i + 1 };
    });

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
        (s: { aprovado: boolean | null; createdAt: Date }) => s.createdAt >= w.start && s.createdAt < w.end
      );
      const approved = inRange.filter((s: { aprovado: boolean | null }) => s.aprovado === true).length;
      const rejected = inRange.filter((s: { aprovado: boolean | null }) => s.aprovado === false).length;

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
