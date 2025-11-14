import { Request, Response } from "express";
import { PrismaClient, PosicaoCampo } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { requireUsage } from "server/lib/usage.js";
import { validarJanelaAtleta, getRangeFromQuery, PlanoAtleta } from "../utils/analyticsWindow.js";

const prisma = new PrismaClient();

function pickId(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (raw?.id) return String(raw.id);
  if (raw?.value) return String(raw.value);
  if (Array.isArray(raw) && raw[0]?.id) return String(raw[0].id);
  return undefined;
}

function pontosDesafioInd(s: any) {
  const cand = [
    s?.pontosCreditados,   
    s?.pontuacaoSnapshot,   
    s?.pontuacao,           
    s?.desafio?.pontuacao, 
  ];
  const n = cand
    .map(v => Number(v))
    .find(v => Number.isFinite(v) && v > 0);
  return n ?? 0;
}

function pontosGrupo(p: any): number {
  const baseCandidates = [
    p?.pontosGanhos,                            
    p?.desafioEmGrupo?.pontosAcumulados,     
    p?.desafioEmGrupo?.pontosSnapshot,
  ];
  const base = baseCandidates
    .map((v) => Number(v))
    .find((v) => Number.isFinite(v) && v > 0) ?? 0;

  const bonus = Number(p?.desafioEmGrupo?.bonus) || 0;
  const bonusDado = !!p?.desafioEmGrupo?.bonusDado;

  return base + (bonusDado ? bonus : 0);
}

async function getParticipacoesGrupo(usuarioId: string, atletaId: string) {
  try {
    return await prisma.submissaoDesafioEmGrupo.findMany({
      where: {
        OR: [
          { usuarioId },                            
          { submissaoDesafio: { atletaId } },    
        ],
      },
      include: {
        desafioEmGrupo: {
          include: {
            grupo: true,
            desafioOficial: true,
          },
        },
      },
      orderBy: { dataEnvio: "desc" },
    });
  } catch {
    return [];
  }
}

function mapGrupoToAtividade(p: any) {
  const g = p.desafioEmGrupo;
  const desafio = g?.desafioOficial;
  return {
    id: `g-${p.id}`,
    tipo: "Desafio" as const,
    imagemUrl: desafio?.imagemUrl ?? null,
    nome: desafio?.titulo ?? g?.grupo?.nome ?? "Desafio em grupo",
    data: p.dataEnvio ?? g?.dataCriacao,
    duracao: undefined,
    pontuacao: pontosGrupo(p),
  };
}

// GET /api/perfil/:id/pontuacao-historico?from=2024-01-01&to=2024-03-01
export async function historicoPontuacaoAtleta(req: AuthenticatedRequest, res: Response) {
  try {
    const atletaParam = req.params.id;

    // aceitar tanto id de atleta quanto usuarioId
    const atleta = await prisma.atleta.findFirst({
      where: {
        OR: [{ id: atletaParam }, { usuarioId: atletaParam }],
      },
      select: { id: true },
    });

    if (!atleta) {
      return res.status(404).json({ message: "Atleta não encontrado." });
    }

    const plano = (req.user?.plano ?? "FREE") as PlanoAtleta;

    // Free -> 30 dias, Pro -> 365
    const defaultDias = plano === "FREE" ? 30 : 365;
    let { from, to } = getRangeFromQuery(req.query, defaultDias);

    // aqui é onde a regra de janela entra (lança erro se passar do limite)
    validarJanelaAtleta(plano, from, to);

    const [subsTreino, subsDesafio] = await Promise.all([
      prisma.submissaoTreino.findMany({
        where: {
          atletaId: atleta.id,
          aprovado: true as any,
          criadoEm: { gte: from, lte: to },
        },
        include: {
          treinoAgendado: {
            include: {
              treinoProgramado: { include: { exercicios: true } },
            },
          },
        },
        orderBy: { criadoEm: "asc" },
      }),
      prisma.submissaoDesafio.findMany({
        where: {
          atletaId: atleta.id,
          aprovado: true as any,
          createdAt: { gte: from, lte: to },
        },
        include: { desafio: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const historicoTreinos = subsTreino.map((s: any) => {
      const dur =
        s.duracaoMinutos ??
        s.treinoAgendado?.treinoProgramado?.duracao ??
        null;

      const pts =
        s.pontosCreditados ??
        s.pontuacaoSnapshot ??
        s.treinoAgendado?.treinoProgramado?.pontuacao ??
        s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
        0;

      const ts = +new Date(s.criadoEm);

      return {
        tipo: "Treino" as const,
        status: "Treino Concluído",
        data: new Date(ts).toLocaleDateString("pt-BR"),
        ts,
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        titulo:
          s.treinoAgendado?.treinoProgramado?.nome ??
          s.treinoAgendado?.titulo ??
          "Treino",
        pontuacao: Number(pts) || 0,
      };
    });

    const historicoDesafios = subsDesafio.map((s: any) => {
      const ts = +new Date(s.createdAt);
      return {
        tipo: "Desafio" as const,
        status: "Desafio Concluído",
        data: new Date(ts).toLocaleDateString("pt-BR"),
        ts,
        titulo: s.desafio?.titulo ?? "Desafio",
        pontuacao: pontosDesafioInd(s),
      };
    });

    const items = [...historicoTreinos, ...historicoDesafios]
      .sort((a, b) => a.ts - b.ts)
      .map(({ ts, ...rest }) => rest);

    return res.json({
      range: { from, to },
      items,
    });
  } catch (err: any) {
    if (err.code === "WINDOW_TOO_LARGE") {
      return res.status(422).json({
        code: err.code,
        message: err.message,
        limitDays: err.limiteDias,
      });
    }

    console.error("historicoPontuacaoAtleta", err);
    return res
      .status(500)
      .json({ message: "Erro ao buscar histórico de pontuação." });
  }
}


function mapGrupoToHistorico(p: any) {
  const g = p.desafioEmGrupo;
  const desafio = g?.desafioOficial;
  const ts = +new Date(p.dataEnvio ?? g?.dataCriacao ?? Date.now());
  return {
    tipo: "Desafio" as const,
    status: "Concluído (grupo)",
    data: new Date(ts).toLocaleDateString("pt-BR"),
    ts,
    titulo: desafio?.titulo ?? g?.grupo?.nome ?? "Desafio em grupo",
    pontuacao: pontosGrupo(p),
  };
}

async function resolveByUsuarioOrEntity(opts: {
  entity: "professor" | "clube" | "escolinha" | "olheiro";
  usuarioOrEntityId: string;
  select: any;
}): Promise<any> {
  const { entity, usuarioOrEntityId, select } = opts;

  if (entity === "professor") {
    let row = await prisma.professor.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.professor.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "clube") {
    let row = await prisma.clube.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.clube.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "escolinha") {
    let row = await prisma.escolinha.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.escolinha.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "olheiro") {
    let row = await prisma.olheiro.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.olheiro.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  return null;
}

async function countAtletasPorEntidade(opts: { escolinhaId?: string; clubeId?: string }) {
  const { escolinhaId, clubeId } = opts;

  const relWhere: any = { atletaId: { not: null } };
  if (escolinhaId) relWhere.escolinhaId = escolinhaId;
  if (clubeId) relWhere.clubeId = clubeId;

  const rel = await prisma.relacaoTreinamento.findMany({
    where: relWhere,
    select: { atletaId: true },
  });

  const diretos = await prisma.atleta.findMany({
    where: {
      ...(escolinhaId ? { escolinhaId } : {}),
      ...(clubeId ? { clubeId } : {}),
    },
    select: { id: true },
  });

  return new Set([
    ...rel.map(r => r.atletaId!).filter(Boolean),
    ...diretos.map(a => a.id),
  ]).size;
}

export async function getPontuacaoDetalhada(req: Request, res: Response) {
  try {
    const id = req.params.id;

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ usuarioId: id }, { id }] },
      select: { id: true },
    });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { treinoAgendado: { include: { treinoProgramado: { include: { exercicios: true } } } } },
      orderBy: { criadoEm: "desc" },
    });

    const historicoTreinos = subsTreino.map((s) => {
      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const pts =
        s.pontosCreditados ??
        s.pontuacaoSnapshot ??
        s.treinoAgendado?.treinoProgramado?.pontuacao ??
        s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
        0;

      return {
        tipo: "Treino" as const,
        titulo: s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino",
        status: "Treino Concluído",
        data: new Date(s.criadoEm).toLocaleDateString("pt-BR"),
        ts: +new Date(s.criadoEm),
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        pontuacao: Number(pts) || 0,
      };
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    });

    const historicoDesafios = subsDesafio.map((s) => ({
      tipo: "Desafio" as const,
      status: "Desafio Concluído",
      data: new Date(s.createdAt).toLocaleDateString("pt-BR"),
      ts: +new Date(s.createdAt),
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: pontosDesafioInd(s as any),
    }));

    let historicoGrupo: any[] = [];
    try {
      const parts = await getParticipacoesGrupo(req.params.id, atleta.id);
      historicoGrupo = parts.map(mapGrupoToHistorico);
    } catch (e) {
      console.warn("[pontuacaoDetalhada] erro ao ler grupos", e);
    }

    const historico = [...historicoTreinos, ...historicoDesafios, ...historicoGrupo]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map(({ ts, ...rest }) => rest);

    const performanceFromHistorico = historico.reduce(
      (acc: number, h: any) => acc + (Number((h as any).pontuacao) || 0),
      0
    );
    const disciplinaFromHistorico = historicoTreinos.length * 2;
    const responsabilidadeFromHistorico = (historicoDesafios.length + historicoGrupo.length) * 2;

    return res.json({
      performance: performanceFromHistorico,
      disciplina: disciplinaFromHistorico,
      responsabilidade: responsabilidadeFromHistorico,
      historico,
      videos: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao montar pontuação" });
  }
}

export const getPerfilUsuarioMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { ...(req as any).params, id };
  return getPerfilUsuario(req as any, res);
};

export const getPontuacaoMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getPontuacaoDetalhada(req as any, res);
};

export const getAtividadesRecentesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getAtividadesRecentes(req as any, res);
};

export const getBadgesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getBadges(req as any, res);
};

export const getTreinosPorUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const treinos = await prisma.treinoRealizado.findMany({
      where: { usuarioId: id },
      include: { treino: true },
      orderBy: { dataExpiracao: "desc" },
    });

    const resultado = treinos.map((t: any) => ({
      titulo: t.treino?.nome || "Treino",
      dataExpiracao: t.dataExpiracao,
      local: t.local || "Local não informado",
    }));

    return res.json(resultado);
  } catch (err) {
    console.error("Erro ao buscar treinos:", err);
    return res.status(500).json({ message: "Erro ao buscar treinos." });
  }
};

export const getAtividadesRecentes = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: userId },
    select: { id: true },
  });
  if (!atleta) return res.json([]);

  const [subsTreino, subsDesafio] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { treinoAgendado: { include: { treinoProgramado: { include: { exercicios: true } } } } },
      orderBy: { criadoEm: "desc" },
      take: 10,
    }),
    prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const parts = await getParticipacoesGrupo(userId, atleta.id);
  const itensGrupo = parts.map(mapGrupoToAtividade);

const itens = [
  ...subsTreino.map((s: any) => {
    const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
    const pts =
      s.pontosCreditados ??
      s.pontuacaoSnapshot ??
      s.treinoAgendado?.treinoProgramado?.pontuacao ??
      s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
      0;

    return {
      id: `t-${s.id}`,
      tipo: "Treino" as const,
      imagemUrl: s.treinoAgendado?.treinoProgramado?.imagemUrl ?? null,
      nome: s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino",
      data: s.criadoEm,
      duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
      pontuacao: Number(pts) || 0,
      categoria:
        s.tipoTreinoSnapshot ?? s.treinoAgendado?.treinoProgramado?.tipoTreino ?? null,
    };
  }),
  ...subsDesafio.map((s: any) => ({
    id: `d-${s.id}`,
    tipo: "Desafio" as const,
    imagemUrl: s.desafio?.imagemUrl ?? s.videoUrl ?? null,
    nome: s.desafio?.titulo ?? "Desafio",
    data: s.createdAt,
    duracao: undefined,
    pontuacao: Number(s.desafio?.pontuacao ?? 0),
  })),
  ...itensGrupo,
]
  .sort((a, b) => +new Date(b.data as any) - +new Date(a.data as any))
  .slice(0, 10);

return res.json(itens);
}

export const getBadges = async (_req: Request, res: Response) => {
  try {
    const badges = [
      { id: "1", nome: "Disciplina", icon: "stopwatch" },
      { id: "2", nome: "Pontualidade", icon: "bullseye" },
      { id: "3", nome: "Liderança", icon: "medal" },
    ];

    res.json(badges);
  } catch (err) {
    console.error("Erro ao buscar badges:", err);
    res.status(500).json({ error: "Erro ao buscar badges." });
  }
};

async function calcularPontuacaoBase(usuarioId: string) {
  const atleta = await prisma.atleta.findFirst({
    where: { usuarioId },
    select: { id: true },
  });
  if (!atleta) {
    return { performance: 0, disciplina: 0, responsabilidade: 0, subsTreino: [], subsDesafio: [] as any[] };
  }

  const [subsTreino, subsDesafio] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { treinoAgendado: { include: { treinoProgramado: true } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pontosTreinos = subsTreino.reduce((acc: number, s: any) => {
    const p = s?.pontosCreditados ?? s?.pontuacaoSnapshot ?? s?.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    return acc + (Number(p) || 0);
  }, 0);

  const pontosDesafios = subsDesafio.reduce((acc: number, s: any) => {
    const p = s?.desafio?.pontuacao ?? 0;
    return acc + (Number(p) || 0);
  }, 0);

  const performance = pontosTreinos + pontosDesafios;
  const disciplina = subsTreino.length * 2;
  const responsabilidade = subsDesafio.length * 2;

  return { performance, disciplina, responsabilidade, subsTreino, subsDesafio };
}

export async function getPontuacaoPerfil(req: Request, res: Response) {
  const { usuarioId } = req.params as { usuarioId: string };

  try {
    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta) {
      return res.json({
        performance: 0,
        disciplina: 0,
        responsabilidade: 0,
        historico: [],
        videos: [],
      });
    }

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: {
        treinoAgendado: {
          include: { treinoProgramado: { include: { exercicios: true } } },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const agIds = Array.from(new Set(subsTreino.map((s) => s.treinoAgendadoId).filter(Boolean)));
    const agRows = agIds.length
      ? await prisma.treinoAgendado.findMany({
          where: { id: { in: agIds } },
          select: {
            id: true,
            treinoProgramado: { select: { pontuacao: true, exercicios: true, duracao: true, nome: true } },
          },
        })
      : [];
    const progPontuacaoMap = new Map<
      string,
      { pontuacao: number; exerciciosCount: number }
    >(agRows.map((r) => [r.id, { pontuacao: r.treinoProgramado?.pontuacao ?? 0, exerciciosCount: r.treinoProgramado?.exercicios?.length ?? 0 }]));

    const historicoTreinos = subsTreino.map((s: any) => {
      const fromCredit = Number(s.pontosCreditados ?? 0);
      const fromSnap = Number(s.pontuacaoSnapshot ?? 0);
      const fromIncludeProg = Number(s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0);
      const fromIncludeExLen = Number(s.treinoAgendado?.treinoProgramado?.exercicios?.length ?? 0);
      const fromMap = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.pontuacao : 0;
      const fromMapEx = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.exerciciosCount : 0;

      const pontos =
        fromCredit > 0 ? fromCredit :
        fromSnap > 0 ? fromSnap :
        fromIncludeProg > 0 ? fromIncludeProg :
        fromMap > 0 ? fromMap :
        fromIncludeExLen > 0 ? fromIncludeExLen :
        fromMapEx > 0 ? fromMapEx : 0;

      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const titulo = s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino";

      return {
        tipo: "Treino" as const,
        status: "Concluído",
        data: new Date(s.criadoEm ?? Date.now()).toLocaleDateString("pt-BR"),
        ts: +new Date(s.criadoEm ?? Date.now()),
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        titulo,
        pontuacao: Number(pontos) || 0,
      };
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    });

    const historicoDesafios = subsDesafio.map((s: any) => ({
      tipo: "Desafio" as const,
      status: "Concluído",
      data: new Date(s.createdAt ?? Date.now()).toLocaleDateString("pt-BR"),
      ts: +new Date(s.createdAt ?? Date.now()),
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: Number(s.desafio?.pontuacao ?? 0),
    }));

    const disciplinaFromHistorico = historicoTreinos.length * 2;

    const parts = await getParticipacoesGrupo(usuarioId, atleta.id);
    const historicoGrupo = parts.map(mapGrupoToHistorico);

    const historico = [...historicoTreinos, ...historicoDesafios, ...historicoGrupo]
      .sort((a, b) => (b as any).ts - (a as any).ts)
      .slice(0, 20)
      .map(({ ts, ...rest }) => rest);

    const performanceFromHistorico = historico.reduce(
      (acc: number, h: any) => acc + (Number((h as any).pontuacao) || 0),
      0
    );
    const responsabilidadeFromHistorico = (historicoDesafios.length + historicoGrupo.length) * 2;

    const postagensVideo = await prisma.postagem.findMany({
      where: { usuarioId, videoUrl: { not: null } },
      select: { videoUrl: true },
      orderBy: { dataCriacao: "desc" },
      take: 30,
    });

    const videos = postagensVideo.flatMap((p) => (p.videoUrl ? [p.videoUrl] : []));

    return res.json({
      performance: performanceFromHistorico,
      disciplina: disciplinaFromHistorico,
      responsabilidade: responsabilidadeFromHistorico,
      historico,
      videos,
    });
  } catch (err) {
    console.error("getPontuacaoPerfil error:", err);
    return res.status(500).json({ message: "Erro ao carregar pontuação." });
  }
}

export const getPerfilUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, foto: true, nomeDeUsuario: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let dadosEspecificos: any = null;
    let tipoPerfil: "Atleta" | "Professor" | "Clube" | "Escolinha" | "Olheiro" | null = null;

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      select: {
        id: true,
        nome: true, sobrenome: true, idade: true, cpf: true,
        telefone1: true, telefone2: true,
        nacionalidade: true, naturalidade: true,
        posicao: true, altura: true, peso: true,
        seloQualidade: true, foto: true, escolinhaId: true, clubeId: true
      }
    });

    if (atleta) {
      const [escolaMin, clubeMin, relProf] = await Promise.all([
        atleta.escolinhaId
          ? prisma.escolinha.findUnique({
              where: { id: atleta.escolinhaId },
              select: { id: true, nome: true },
            })
          : null,
        atleta.clubeId
          ? prisma.clube.findUnique({
              where: { id: atleta.clubeId },
              select: { id: true, nome: true },
            })
          : null,
        prisma.relacaoTreinamento.findFirst({
          where: { atletaId: atleta.id, professorId: { not: null } },
          include: { professor: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: "desc" },
        }),
      ]);

      dadosEspecificos = {
        atletaId: atleta.id,        
        nome: atleta.nome,
        sobrenome: atleta.sobrenome,
        idade: atleta.idade,
        telefone1: atleta.telefone1,
        telefone2: atleta.telefone2,
        nacionalidade: atleta.nacionalidade,
        naturalidade: atleta.naturalidade,
        posicao: atleta.posicao,
        altura: atleta.altura,
        peso: atleta.peso,
        seloQualidade: atleta.seloQualidade,
        foto: atleta.foto,
        escolinhaId: atleta.escolinhaId,
        clubeId: atleta.clubeId,
        escola: escolaMin?.nome ?? null,
        clube:  clubeMin?.nome  ?? null,
        professor: relProf?.professor?.nome ?? null,
      };
      tipoPerfil = "Atleta";
    }

    const professor = await prisma.professor.findUnique({ where: { usuarioId: id } });
    if (professor) {
      dadosEspecificos = {
        nome: professor.nome,
        codigo: professor.codigo,
        cref: professor.cref,
        areaFormacao: professor.areaFormacao,
        escola: professor.escola,
        qualificacoes: professor.qualificacoes,
        certificacoes: professor.certificacoes,
        foto: professor.fotoUrl,
      };
      tipoPerfil = "Professor";
    }

    const escolinha = await prisma.escolinha.findUnique({ where: { usuarioId: id } });
    if (escolinha) {
      dadosEspecificos = {
        nome: escolinha.nome,
        email: escolinha.email,
        cidade: escolinha.cidade,
        estado: escolinha.estado,
        pais: escolinha.pais,
        bairro: escolinha.bairro,
        telefone1: escolinha.telefone1,
        telefone2: escolinha.telefone2,
        logo: escolinha.logo,
        siteOficial: escolinha.siteOficial,
      };
      tipoPerfil = "Escolinha";
    }

    const clube = await prisma.clube.findUnique({ where: { usuarioId: id } });
    if (clube) {
      dadosEspecificos = {
        nome: clube.nome,
        email: clube.email,
        cidade: clube.cidade,
        estado: clube.estado,
        pais: clube.pais,
        bairro: clube.bairro,
        telefone1: clube.telefone1,
        telefone2: clube.telefone2,
        estadio: clube.estadio,
        logo: clube.logo,
        siteOficial: clube.siteOficial,
      };
      tipoPerfil = "Clube";
    }

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId: id },
      select: {
        id: true,
        fotoUrl: true,
        headline: true,
        areaAtuacao: true,
        anosExperiencia: true,
        descricao: true,
        emailPublico: true,
        telefonePublico: true,
        siteOuLinkedin: true,
        colaboracaoClube: { select: { id: true, nome: true, logo: true, usuarioId: true } },
      },
    });

    if (olheiro) {
      dadosEspecificos = {
        id: olheiro.id,
        foto: olheiro.fotoUrl,
        headline: olheiro.headline,
        areaAtuacao: olheiro.areaAtuacao,
        anosExperiencia: olheiro.anosExperiencia,
        descricao: olheiro.descricao,
        emailPublico: olheiro.emailPublico,
        telefonePublico: olheiro.telefonePublico,
        siteOuLinkedin: olheiro.siteOuLinkedin,
        colaboracaoClube: olheiro.colaboracaoClube
          ? { id: olheiro.colaboracaoClube.id, nome: olheiro.colaboracaoClube.nome, logo: olheiro.colaboracaoClube.logo }
          : null,
      };
      tipoPerfil = "Olheiro";
    }

    if (!tipoPerfil) {
      const olheiro = await prisma.olheiro.findUnique({
        where: { usuarioId: id },
        select: {
          id: true,
          fotoUrl: true,
          headline: true,
          areaAtuacao: true,
          anosExperiencia: true,
        },
      });
      if (olheiro) {
        dadosEspecificos = {
          id: olheiro.id,
          foto: olheiro.fotoUrl,
          headline: olheiro.headline,
          areaAtuacao: olheiro.areaAtuacao,
          anosExperiencia: olheiro.anosExperiencia,
        };
        tipoPerfil = "Olheiro";
      }
    }

    return res.json({
      tipo: tipoPerfil,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        foto: usuario.foto,
      },
      dadosEspecificos,
    });

  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const atualizarPerfil = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userIdFromToken = req.userId;
  if (!userIdFromToken || id !== userIdFromToken) {
    return res.status(403).json({ error: "Você só pode editar o seu próprio perfil." });
  }

  const { usuario, tipo, tipoUsuario } = req.body;
  if (!usuario || !tipoUsuario || !tipo) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  const fotoFinal: string | null = file ? `/uploads/${file.filename}` : (usuario.foto ?? null);

  try {
    await prisma.usuario.update({
      where: { id },
      data: {
        nome: usuario.nome,
        email: usuario.email,
        nomeDeUsuario: usuario.nomeDeUsuario ?? undefined,
        foto: fotoFinal,
        cidade: usuario.cidade,
        estado: usuario.estado,
        pais: usuario.pais,
        bairro: usuario.bairro,
      }
    });

    const tipoKey = String(tipoUsuario).toLowerCase();
    const tipoNorm = (tipoKey === "escolinha") ? "escola" : tipoKey;

    switch (tipoNorm) {
      case "atleta": {
        let escolinhaId =
          pickId(tipo.escolinhaId) ??
          pickId(tipo.escolaId) ??
          pickId(tipo.escolinha) ??
          pickId(tipo.escola);

        let clubeId = pickId(tipo.clubeId) ?? pickId(tipo.clube);

        const data: any = {
          nome: tipo.nome,
          sobrenome: tipo.sobrenome,
          idade: isNaN(parseInt(tipo.idade)) ? undefined : parseInt(tipo.idade),
          telefone1: tipo.telefone1,
          telefone2: tipo.telefone2,
          nacionalidade: tipo.nacionalidade,
          naturalidade: tipo.naturalidade,
          posicao: tipo.posicao,
          altura: isNaN(parseFloat(tipo.altura)) ? undefined : parseFloat(tipo.altura),
          peso:   isNaN(parseFloat(tipo.peso))   ? undefined : parseFloat(tipo.peso),
          seloQualidade: tipo.seloQualidade,
          foto: fotoFinal,
        };

        if (typeof escolinhaId !== "undefined") data.escolinhaId = escolinhaId;
        if (typeof clubeId !== "undefined") data.clubeId = clubeId;

        const atletaRow = await prisma.atleta.findUnique({
          where: { usuarioId: id },
          select: { id: true },
        });
        if (!atletaRow) {
          return res.status(404).json({ error: "Atleta não encontrado para este usuário." });
        }
        const atletaId = atletaRow.id;

        await prisma.$transaction(async (tx) => {
          await tx.atleta.update({ where: { usuarioId: id }, data });

          if (typeof escolinhaId !== "undefined") {
            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, escolinhaId: { not: escolinhaId } },
            });
            if (escolinhaId) {
              const existe = await tx.relacaoTreinamento.findFirst({ where: { atletaId, escolinhaId } });
              if (!existe) await tx.relacaoTreinamento.create({ data: { atletaId, escolinhaId } });
            }
          }

          if (typeof clubeId !== "undefined") {
            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, clubeId: { not: clubeId } },
            });
            if (clubeId) {
              const existe = await tx.relacaoTreinamento.findFirst({ where: { atletaId, clubeId } });
              if (!existe) await tx.relacaoTreinamento.create({ data: { atletaId, clubeId } });
            }
          }
        });

        break;
      }

      case "professor":
        await prisma.professor.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            cref: tipo.cref,
            areaFormacao: tipo.areaFormacao,
            escola: tipo.escola,
            qualificacoes: Array.isArray(tipo.qualificacoes) ? tipo.qualificacoes : tipo.qualificacoes?.split(',').map((q: string) => q.trim()),
            certificacoes: Array.isArray(tipo.certificacoes) ? tipo.certificacoes : tipo.certificacoes?.split(',').map((c: string) => c.trim()),
            fotoUrl: fotoFinal,
          }
        });
        break;

      case "clube": {
        const data: any = {
          nome: tipo.nome,
          telefone1: tipo.telefone1 ?? null,
          telefone2: tipo.telefone2 ?? null,
          email: tipo.email ?? null,
          siteOficial: tipo.siteOficial ?? null,
          sede: tipo.sede ?? null,
          estadio: tipo.estadio ?? null,
          logradouro: tipo.logradouro ?? null,
          numero: tipo.numero ?? null,
          complemento: tipo.complemento ?? null,
          bairro: tipo.bairro ?? null,
          cidade: tipo.cidade ?? null,
          estado: tipo.estado ?? null,
          pais: tipo.pais ?? null,
          cep: tipo.cep ?? null,
          descricao: tipo.descricao ?? null,
          responsavel: tipo.responsavel ?? null,
          logo: fotoFinal,
        };
        if (Array.isArray(tipo.categorias)) data.categorias = { set: tipo.categorias };

        await prisma.clube.update({ where: { usuarioId: id }, data });
        break;
      }

      case "olheiro": {
        const anos = (typeof tipo.anosExperiencia === "string" && tipo.anosExperiencia !== "")
          ? Number(tipo.anosExperiencia)
          : tipo.anosExperiencia;

        await prisma.olheiro.update({
          where: { usuarioId: id },
          data: {
            headline:        tipo.headline ?? null,
            descricao:       tipo.descricao ?? null,
            areaAtuacao:     tipo.areaAtuacao ?? null,
            anosExperiencia: Number.isFinite(anos) ? (anos as number) : undefined,
            emailPublico:    tipo.emailPublico ?? null,
            telefonePublico: tipo.telefonePublico ?? null,
            siteOuLinkedin:  tipo.siteOuLinkedin ?? null,
            fotoUrl:         fotoFinal,
          },
        });
        break;
      }

      case "escola":
        await prisma.escolinha.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede,
            logradouro: tipo.logradouro,
            numero: tipo.numero,
            complemento: tipo.complemento,
            bairro: tipo.bairro,
            cidade: tipo.cidade,
            estado: tipo.estado,
            pais: tipo.pais,
            cep: tipo.cep,
            logo: fotoFinal,
          }
        });
        break;

      default:
        return res.status(400).json({ error: `Tipo de usuário inválido: ${tipoUsuario} (aceitos: atleta, professor, clube, escola/escolinha, olheiro)` });
    }

    return res.status(200).json({ message: "Perfil atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
};

export const getProgressoTreinos = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      include: {
        treinosRecebidos: {
          include: {
            treino: {
              include: {
                exercicios: {
                  include: { exercicio: true }
                }
              }
            }
          }
        }
      }
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado" });
    }

    const categoriaContagem: Record<string, number> = {
      fisico: 0, tecnico: 0, tatico: 0, mental: 0,
    };

    for (const recebido of atleta.treinosRecebidos) {
      const rawTipo = recebido.treino?.tipoTreino ?? "";
      const norm = String(rawTipo)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      if (norm.startsWith("fis")) categoriaContagem.fisico++;
      else if (norm.startsWith("tec")) categoriaContagem.tecnico++;
      else if (norm.startsWith("tat")) categoriaContagem.tatico++;
      else if (norm.startsWith("men")) categoriaContagem.mental++;
    }

    const desafiosIndividuais = await prisma.submissaoDesafio.count({
      where: { atletaId: atleta.id, aprovado: true },
    });

    const partsGrupo = await getParticipacoesGrupo(id, atleta.id);
    const totalPontosGrupo = partsGrupo.reduce((acc: number, item: any) => acc + pontosGrupo(item), 0);

    const pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId: atleta.id } });
    const pontosConquistadosBase = pontuacao
      ? pontuacao.pontuacaoDisciplina + pontuacao.pontuacaoPerformance + pontuacao.pontuacaoResponsabilidade
      : 0;

    const pontosConquistados = pontosConquistadosBase + totalPontosGrupo;

    const desafiosGrupo = partsGrupo.length;
    const desafiosCompletos = desafiosIndividuais + desafiosGrupo;

    return res.json({
      ...categoriaContagem,
      totalTreinos: atleta.treinosRecebidos.length,
      horasTreinadas: Number((atleta.treinosRecebidos.length * 0.5).toFixed(1)),
      desafiosCompletos,
      pontosConquistados
    });
  } catch (err) {
    console.error("Erro ao buscar progresso dos treinos:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const getTreinosResumo = async (req: any, res: Response) => {
  try {
    const usuarioId =
      req.params?.id ?? req.params?.usuarioId ?? req.userId;

    if (!usuarioId) {
      return res.status(400).json({ error: "usuarioId ausente" });
    }

    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true },
    });

    if (!atleta) {
      return res.status(200).json({
        completos: 0,
        horas: 0,
        desafios: 0,
        categorias: { Fisico: 0, Tecnico: 0, Tatico: 0, Mental: 0 },
      });
    }

    const [subsTreino, desafios] = await Promise.all([
      prisma.submissaoTreino.findMany({
        where: { atletaId: atleta.id, aprovado: true },
        include: { treinoAgendado: { include: { treinoProgramado: true } } },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.submissaoDesafio.count({
        where: { atletaId: atleta.id, aprovado: true },
      }),
    ]);

    const completos = subsTreino.length;

    let minutos = 0;
    const categorias = { Fisico: 0, Tecnico: 0, Tatico: 0, Mental: 0 };

    for (const s of subsTreino as any[]) {
      const dur =
        Number(s?.duracaoMinutos) ||
        Number(s?.duracao) ||
        Number(s?.treinoAgendado?.treinoProgramado?.duracao) ||
        0;
      minutos += isFinite(dur) ? dur : 0;

      const rawTipo =
        s?.tipoTreinoSnapshot ??
        s?.treinoAgendado?.treinoProgramado?.tipoTreino ??
        "";

      const norm = String(rawTipo)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      if (norm.startsWith("fis")) categorias.Fisico++;
      else if (norm.startsWith("tec")) categorias.Tecnico++;
      else if (norm.startsWith("tat")) categorias.Tatico++;
      else if (norm.startsWith("men")) categorias.Mental++;
    }

    const horas = Math.round((minutos / 60) * 10) / 10;

    const desafiosGrupo = await prisma.submissaoDesafioEmGrupo.count({
      where: {
        OR: [
          { usuarioId: usuarioId },
          { submissaoDesafio: { atletaId: atleta.id } },
        ],
      },
    });

      return res.status(200).json({
        completos,
        horas,
        desafios: desafios + desafiosGrupo,
        categorias,
      });
  } catch (e) {
    console.error("[getTreinosResumo] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar resumo de treinos" });
  }
};

export const getPosicaoAtualAtleta = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.params?.id || req.userId;

  if (!usuarioId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true, posicao: true },
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado para este usuário." });
    }

    const vinculoMaisRecente = await prisma.atletaElenco.findFirst({
      where: { atletaId: atleta.id, elenco: { ativo: true } },
      include: {
        elenco: { select: { id: true, nome: true, ativo: true, dataCriacao: true } },
      },
      orderBy: [
        { elenco: { dataCriacao: "desc" } },
        { updatedAt: "desc" },
      ],
    });

    if (vinculoMaisRecente && vinculoMaisRecente.posicao) {
      return res.json({
        origem: "elenco" as const,
        posicao: vinculoMaisRecente.posicao,
        atletaId: atleta.id,
        usuarioId,
        elenco: vinculoMaisRecente.elenco
          ? {
              id: vinculoMaisRecente.elenco.id,
              nome: vinculoMaisRecente.elenco.nome,
              ativo: vinculoMaisRecente.elenco.ativo,
            }
          : undefined,
        numeroCamisa: vinculoMaisRecente.numeroCamisa ?? null,
        updatedAt: vinculoMaisRecente.updatedAt?.toISOString?.() ?? null,
      });
    }

    return res.json({
      origem: "atleta" as const,
      posicao: (atleta.posicao as PosicaoCampo) ?? null,
      atletaId: atleta.id,
      usuarioId,
    });
  } catch (error) {
    console.error("Erro ao obter posição atual do atleta:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export async function getPerfilProfessor(req: AuthenticatedRequest, res: Response) {
  try {
    let { id } = req.params; 

    if (id === "me") {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: req.userId },
        select: { id: true },
      });
      if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
      id = prof.id;
    }

    const prof = await resolveByUsuarioOrEntity({
      entity: "professor",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        codigo: true,
        cref: true,
        areaFormacao: true,
        escola: true,
        qualificacoes: true,
        certificacoes: true,
        fotoUrl: true,
        statusCref: true,
        clubeId: true,
        escolinhaId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        treinosProgramados: { select: { id: true } },
        relacoesTreinamento: { select: { atletaId: true, clubeId: true, escolinhaId: true } },
      },
    });

    if (!prof) return res.status(404).json({ error: "Professor não encontrado" });

    const rels = await prisma.relacaoTreinamento.findMany({
      where: { professorId: prof.id, atletaId: { not: null } },
      select: { atletaId: true },
    });

    const atletasDiretosClube = (prof as any).clubeId
      ? await prisma.atleta.findMany({ where: { clubeId: (prof as any).clubeId }, select: { id: true } })
      : [];
    const atletasDiretosEscolinha = (prof as any).escolinhaId
      ? await prisma.atleta.findMany({ where: { escolinhaId: (prof as any).escolinhaId }, select: { id: true } })
      : [];

    const uniq = new Set<string>([
      ...rels.map(r => r.atletaId!).filter(Boolean),
      ...atletasDiretosClube.map(a => a.id),
      ...atletasDiretosEscolinha.map(a => a.id),
    ]);
    const alunosRelacionados = uniq.size;
    const treinosCount = (prof as any).treinosProgramados?.length ?? 0;

    const unlocked: string[] = [];
    if (treinosCount >= 1)  unlocked.push("primeiro_treino_programado");
    if (treinosCount >= 5)  unlocked.push("serie_de_treinos");
    if (treinosCount >= 10) unlocked.push("planejamento_solido");
    if (alunosRelacionados >= 5) unlocked.push("grupo_inicial");

    let gruposCriados = 0;
    try {
      gruposCriados = await prisma.desafioEmGrupo.count({
        where: {
          OR: [
            { criadoPorId: prof.usuarioId ?? "" },
            { grupo: { ownerId: prof.usuarioId ?? "" } },
          ],
        },
      });
    } catch {}

    let conquistas = unlocked.length;
    if (gruposCriados > 0) conquistas += 1;

    const usuarioMin = (prof as any).usuario ?? null;
    const fotoPerfil: string | null = (prof as any).fotoUrl ?? (usuarioMin?.foto ?? null);

    return res.json({
      tipo: "Professor" as const,
      usuario: usuarioMin,
      professor: {
        id: prof.id,
        usuarioId: prof.usuarioId,
        nome: prof.nome,
        codigo: prof.codigo,
        cref: prof.cref,
        areaFormacao: prof.areaFormacao,
        escola: prof.escola,
        qualificacoes: prof.qualificacoes ?? [],
        certificacoes: prof.certificacoes ?? [],
        fotoUrl: fotoPerfil,
        statusCref: prof.statusCref ?? null,
        clubeId: (prof as any).clubeId ?? null,       
        escolinhaId: (prof as any).escolinhaId ?? null, 
      },
      metrics: {
        treinosProgramados: treinosCount,
        alunosRelacionados,
        conquistas,
        conquistasUnlocked: unlocked,
        gruposCriados,
      },
    });

  } catch (e) {
    console.error("getPerfilProfessor error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar professor" });
  }
}

export async function getPerfilClube(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const clube = await resolveByUsuarioOrEntity({
      entity: "clube",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        estadio: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
        descricao: true,
        responsavel: true,
        categorias: true,
      },
    });

    if (!clube) return res.status(404).json({ error: "Clube não encontrado" });

    const [diretos, relacoes, elencos, aceitos] = await Promise.all([
      prisma.atleta.findMany({ where: { clubeId: clube.id }, select: { id: true } }),
      prisma.relacaoTreinamento.findMany({ where: { clubeId: clube.id, atletaId: { not: null } }, select: { atletaId: true } }),
      prisma.atletaElenco.findMany({ where: { elenco: { clubeId: clube.id } }, select: { atletaId: true } }),
      prisma.solicitacaoVinculo.findMany({
        where: { tipoEntidade: "clube", entidadeId: clube.id, status: "aceito" },
        select: { atletaId: true },
      }),
    ]);

    const ids = new Set<string>([
      ...diretos.map(a => a.id),
      ...relacoes.map(r => r.atletaId!),
      ...elencos.map(e => e.atletaId),
      ...aceitos.map(s => s.atletaId),
    ]);

    const usuarioMin = (clube as any).usuario ?? null;
    const logoOuFoto: string | null = (clube as any).logo ?? (usuarioMin?.foto ?? null);

    return res.json({
      tipo: "Clube" as const,
      usuario: usuarioMin,
      clube: {
        id: clube.id,
        usuarioId: clube.usuarioId,
        nome: clube.nome,
        cnpj: clube.cnpj,
        telefone1: clube.telefone1,
        telefone2: clube.telefone2,
        email: clube.email,
        siteOficial: clube.siteOficial,
        sede: clube.sede,
        estadio: clube.estadio,
        logradouro: clube.logradouro,
        numero: clube.numero,
        complemento: clube.complemento,
        bairro: clube.bairro,
        cidade: clube.cidade,
        estado: clube.estado,
        pais: clube.pais,
        cep: clube.cep,
        logo: logoOuFoto,
        dataCriacao: clube.dataCriacao,
        descricao: (clube as any).descricao ?? null,
        responsavel: (clube as any).responsavel ?? null,
        categorias: (clube as any).categorias ?? [],
      },
      metrics: {
        atletas: ids.size,
        eventos: 0,
        conquistas: 0,
      },
    });
  } catch (e) {
    console.error("getPerfilClube error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar clube" });
  }
}

export async function getPerfilEscola(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const escola = await resolveByUsuarioOrEntity({
      entity: "escolinha",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
      },
    });

    if (!escola) return res.status(404).json({ error: "Escolinha não encontrada" });

    const atletasCount = await countAtletasPorEntidade({ escolinhaId: escola.id });
    const treinosCount = await prisma.treinoProgramado.count({ where: { escolinhaId: escola.id } });

    const usuarioMin = (escola as any).usuario ?? null;
    const logoOuFoto: string | null = (escola as any).logo ?? (usuarioMin?.foto ?? null);

    return res.json({
      tipo: "Escolinha" as const,
      usuario: usuarioMin,
      escolinha: {
        id: escola.id,
        usuarioId: escola.usuarioId,
        nome: escola.nome,
        cnpj: escola.cnpj,
        telefone1: escola.telefone1,
        telefone2: escola.telefone2,
        email: escola.email,
        siteOficial: escola.siteOficial,
        sede: escola.sede,
        logradouro: escola.logradouro,
        numero: escola.numero,
        complemento: escola.complemento,
        bairro: escola.bairro,
        cidade: escola.cidade,
        estado: escola.estado,
        pais: escola.pais,
        cep: escola.cep,
        logo: logoOuFoto,
        dataCriacao: escola.dataCriacao,
      },
      metrics: {
        atletas: atletasCount,
        treinosProgramados: treinosCount,
        postagens: 0,
        conquistas: 0,
      },
    });
  } catch (e) {
    console.error("getPerfilEscola error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar escolinha" });
  }
}

export async function getPerfilOlheiro(req: Request, res: Response) {
  if (req.user?.tipo === 'Olheiro') {
    await requireUsage(req, res, 'perfis_vistos_dia'); // 20/dia no Free
  }
  try {
    const { id } = req.params;
    
    if (req.user?.tipo === "Olheiro" && req.user?.plano !== "PRO") {
      const ok = await requireUsage(req, res, "listas_salvas_total");
      if (!ok) return;
    }

    const olheiro: any = await resolveByUsuarioOrEntity({
      entity: "olheiro",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true } },
        fotoUrl: true,
        headline: true,
        descricao: true,
        areaAtuacao: true,
        anosExperiencia: true,
        emailPublico: true,
        telefonePublico: true,
        siteOuLinkedin: true,
        reputacaoScore: true,
        totalIndicacoes: true,
        colaboracaoClubeId: true,
        colaboracaoClube: { select: { id: true, usuarioId: true, nome: true, logo: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado" });

    const usuarioMin = (olheiro as any).usuario ?? null;

    return res.json({
      tipo: "Olheiro" as const,
      usuario: usuarioMin,
      olheiro: {
        id: olheiro.id,
        usuarioId: olheiro.usuarioId,
        fotoUrl: olheiro.fotoUrl ?? null,
        headline: olheiro.headline ?? null,
        descricao: olheiro.descricao ?? null,
        areaAtuacao: olheiro.areaAtuacao ?? null,
        anosExperiencia: olheiro.anosExperiencia ?? 0,
        emailPublico: olheiro.emailPublico ?? null,
        telefonePublico: olheiro.telefonePublico ?? null,
        siteOuLinkedin: olheiro.siteOuLinkedin ?? null,
        colaboracaoClube: olheiro.colaboracaoClube ? {
          id: olheiro.colaboracaoClube.id,
          usuarioId: olheiro.colaboracaoClube.usuarioId,
          nome: olheiro.colaboracaoClube.nome,
          logo: (olheiro as any).colaboracaoClube?.logo ?? null,
        } : null,
        createdAt: olheiro.createdAt,
        updatedAt: olheiro.updatedAt,
      },
      metrics: {
        observados: 0,
        indicacoes: olheiro.totalIndicacoes ?? 0,
        reputacao: olheiro.reputacaoScore ?? 0,
      },
    });
  } catch (e) {
    console.error("getPerfilOlheiro error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar olheiro" });
  }
}

export const getUltimasSubmissoesDesafioVideos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id || req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado." });

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ usuarioId: userId }, { id: userId }] },
      select: { id: true },
    });
    if (!atleta) return res.json([]);

    const subs = await prisma.submissaoDesafio.findMany({
      where: {
        atletaId: atleta.id,
        aprovado: true as any,       
      },
      select: {
        id: true,
        videoUrl: true,
        createdAt: true,
        desafio: { select: { titulo: true, imagemUrl: true } },
        curtidas: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const itens = subs
      .filter((s) => typeof s.videoUrl === "string" && s.videoUrl.trim() !== "")
      .map((s) => ({
        id: s.id,
        videoUrl: s.videoUrl,
        titulo: s.desafio?.titulo ?? "Desafio",
        thumb: s.desafio?.imagemUrl ?? null,
        createdAt: s.createdAt,
        curtidas: s.curtidas.length,
      }));

    return res.json(itens);
  } catch (e) {
    console.error("getUltimasSubmissoesDesafioVideos error:", e);
    return res.status(500).json({ error: "Erro ao buscar submissões de desafio." });
  }
};

export const getUltimasSubmissoesDesafioVideosMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getUltimasSubmissoesDesafioVideos(req as any, res);
};
