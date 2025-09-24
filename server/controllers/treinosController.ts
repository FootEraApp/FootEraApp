// server/controllers/treinosController
import { Response, Request } from "express";
import { PrismaClient, PosicaoCampo, Categoria, TipoTreino } from "@prisma/client";
import { getIO } from "../socket.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";

const prisma = new PrismaClient();

function normalizeCategorias(input: any): Categoria[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];

  // mapeia "Sub-9", "sub 15", "sub15" -> "Sub9" etc
  const mapOne = (raw: any): string => {
    const s = String(raw).trim();
    const m = s.match(/^sub[\s-]?(\d{1,2})$/i);
    if (m) return `Sub${m[1]}`;
    if (/^livre$/i.test(s)) return "Livre";
    return s; // já pode vir "Sub9"
  };

  const mapped = arr.map(mapOne);
  // valida todas
  const valid = mapped.filter((c) => (Object.values(Categoria) as string[]).includes(c));
  if (valid.length !== mapped.length) {
    // tem algum valor inválido
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
  // já pode vir correto do front
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

export async function treinosDisponiveis(req: AuthenticatedRequest, res: Response) {
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

    const novo = await prisma.treinoAgendado.create({
      data: {
        atletaId,
        treinoProgramadoId,
        titulo: titulo ?? tp.nome,
        dataTreino: new Date(dataTreino),
        dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null,
      },
      include: {
        treinoProgramado: { include: { exercicios: { include: { exercicio: true, exercicioTemporario: true } } } },
      },
    });

    await notificarNovoTreino(deUsuarioId, atletaId, novo.id, novo.titulo ?? tp.nome);
    return res.status(201).json(novo);
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

export async function getTreinosAgendados(req: AuthenticatedRequest, res: Response) {
  try {
    const { atletaId, tipoUsuarioId, usuarioId } = req.query as any;
    const authUserId = req.userId;

    let where: any = {};

    if (atletaId) {
      where.atletaId = String(atletaId);
    }
    else if (tipoUsuarioId) {
      where.atletaId = String(tipoUsuarioId);
    }
    else {
      const uid = String(usuarioId || authUserId || "");
      if (!uid) return res.json([]);

      const usuario = await prisma.usuario.findUnique({
        where: { id: uid },
        include: { atleta: true, professor: true, clube: true, escolinha: true },
      });
      if (!usuario) return res.json([]);

      if (usuario.atleta) where.atletaId = usuario.atleta.id;
      else if (usuario.professor) where.treinoProgramado = { professorId: usuario.professor.id };
      else if (usuario.clube)     where.treinoProgramado = { clubeId: usuario.clube.id };
      else if (usuario.escolinha) where.treinoProgramado = { escolinhaId: usuario.escolinha.id };
      else return res.json([]);
    }

    const itens = await prisma.treinoAgendado.findMany({
      where,
      include: { treinoProgramado: true },
      orderBy: { dataTreino: "desc" },
    });

    return res.json(itens);
  } catch (err) {
    console.error("Erro em getTreinosAgendados:", err);
    return res.status(500).json({ message: "Erro ao buscar treinos agendados" });
  }
}

export async function concluirTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const { treinoAgendadoId, atletaId, pontos } = req.body as {
      treinoAgendadoId: string; atletaId: string; pontos?: number;
    };

    const agendado = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      include: { treinoProgramado: { select: { pontuacao: true, duracao: true, tipoTreino: true, nome: true } } },
    });
    if (!agendado) return res.status(404).json({ error: "Treino agendado não encontrado" });

    const pontosFinais = (typeof pontos === "number" && pontos >= 0)
      ? pontos
      : (agendado.treinoProgramado?.pontuacao ?? 0);

    const existente = await prisma.submissaoTreino.findFirst({
      where: { treinoAgendadoId, atletaId },
    });

    const dataCommon = {
      aprovado: true as any,
      pontuacaoSnapshot: pontosFinais > 0 ? pontosFinais : undefined,
      pontosCreditados:  pontosFinais > 0 ? pontosFinais : undefined,
      duracaoMinutos: agendado.treinoProgramado?.duracao ?? undefined,
      treinoTituloSnapshot: agendado.treinoProgramado?.nome ?? agendado.titulo ?? undefined,
      tipoTreinoSnapshot: agendado.treinoProgramado?.tipoTreino ?? undefined,
    };

    const sub = existente
      ? await prisma.submissaoTreino.update({ where: { id: existente.id }, data: dataCommon })
      : await prisma.submissaoTreino.create({ data: { atletaId, treinoAgendadoId, ...dataCommon } });

    await recomputePontuacaoAtleta(atletaId);
    res.json({ ok: true, pontos: pontosFinais, submissao: sub });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao concluir treino" });
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

    return res.json({ ...elenco, atletasCount: vinculos.length });
  } catch (err) {
    console.error("Erro ao atualizar elenco:", err);
    return res.status(500).json({ error: "Erro ao atualizar elenco" });
  }
}

export async function atletasVinculados(req: Request, res: Response) {
  try {
    const raw = (req.query?.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw || "").trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

    const resolved = await resolveEntidade(tipoUsuarioId);
    if (!resolved) return res.json([]);

    const incluirPontuacao = !!req.query.incluirPontuacao;

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

    if (atletaIds.size === 0) return res.json([]);

    const atletas = await prisma.atleta.findMany({
      where: { id: { in: Array.from(atletaIds) } },
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        foto: true,
        posicao: true,
        idade: true,
        altura: true,
        peso: true,
        categoria: incluirPontuacao,
        pontosTotal: incluirPontuacao, 
        pontuacao: incluirPontuacao ? { select: { pontuacaoTotal: true } } : false,
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      orderBy: { nome: "asc" },
    });

    const payload = atletas.map(a => {
      const ultimaCategoria =
        incluirPontuacao && Array.isArray(a.categoria) && a.categoria.length
          ? a.categoria[a.categoria.length - 1]
          : null;

      const pontos =
        incluirPontuacao
          ? (a as any).pontuacao?.pontuacaoTotal ?? (a as any).pontosTotal ?? null
          : undefined;

      return {
        id: a.usuarioId,            
        atletaId: a.id,
        nome: a.nome ?? a.usuario?.nome ?? "",
        foto: a.foto ?? a.usuario?.foto ?? null,
        posicao: a.posicao ?? null,
        idade: a.idade ?? null,
        altura: a.altura ?? null,
        peso: a.peso ?? null,
        categoria: incluirPontuacao ? ultimaCategoria : undefined,
        pontuacao: incluirPontuacao ? pontos : undefined,
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao buscar atletas vinculados:", error);
    return res.status(500).json({ error: "Erro ao buscar atletas vinculados" });
  }
}

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
      nivel,                  // "Base" | "Avancado" | "Performance"
      exercicios,             // [{ exercicioId? | nome, repeticoes?, ordem? }, ...]
      usuarioId,
      categoria,              // ["Sub-9", "Sub-11", "Livre"] ou ["Sub9", ...]
      tipoTreino,             // "Fisico" | "Físico" | "Tecnico" | "Tático" | ...
      objetivo,
      duracao,
      dataTreino,
      dataAgendada,
      dicas,
      tipoUsuario,            // "professor" | "escolinha" | "clube"
      tipoUsuarioId,
      atletasIds,
    } = req.body as any;

    if (!nome || !nivel || !Array.isArray(exercicios) || !usuarioId || !tipoUsuarioId) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // 🔧 Normalizações amigáveis
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
        categoria: categorias,                 // ✅ já normalizado
        tipoTreino: tipoTreinoNorm,            // ✅ já normalizado
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
          categorias, // ✅ usa as mesmas categorias normalizadas
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

    if (Array.isArray(atletasIds) && atletasIds.length > 0) {
      const whenDate = treino.dataAgendada ?? new Date();
      await Promise.all(
        (atletasIds as string[]).map((atletaId) =>
          prisma.treinoAgendado.create({
            data: {
              titulo: treino.nome,
              dataExpiracao: whenDate,
              dataTreino: whenDate,
              atletaId,
              treinoProgramadoId: treino.id,
            },
          })
        )
      );
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

      for (const [i, e] of exsTemp.entries()) {
        const temp = await tx.exercicioTemporario.create({
          data: {
            treinoProgramadoId: id,
            codigo: null,
            nome: e.nome,
            descricao: e.descricao ?? null,
            nivel: nivel, // mantém o mesmo comportamento anterior
            categorias: categoriasNorm ?? [], // ✅ usa categorias normalizadas
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

// ===== Validação de Submissões de Treino =====

/**
 * Lista submissões de treino para validação, filtrando por vínculo (professor/clube/escolinha -> atletas).
 * GET /treinos/submissoes?tipoUsuarioId=...&status=pendente|todos
 */
export async function listarSubmissoesParaValidacao(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuarioId = String((req.query.tipoUsuarioId ?? "") as string).trim();
    const status = String((req.query.status ?? "pendente") as string).toLowerCase();

    // Resolve entidade (professor/clube/escolinha) a partir do tipoUsuarioId ou do usuário logado
    const resolved = await resolveEntidade(tipoUsuarioId || req.userId!);
    if (!resolved) return res.json([]);

    // Coleta atletas vinculados (mesma lógica do atletasVinculados)
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

    if (atletaIds.size === 0) return res.json([]);

    // Filtro por status
    const where: any = { atletaId: { in: Array.from(atletaIds) } };
    switch (status) {
      case "pendente":
        // considerar pendente tudo que NÃO está aprovado ainda
        // (pega aprovado = null ou false; se quiser ignorar reprovados antigos, usa a segunda condição)
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
      // "todos" = sem filtro extra
    }

    const subs = await prisma.submissaoTreino.findMany({
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
      orderBy: { criadoEm: "desc" },
    });

    const payload = subs.map(s => {
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
        midias: s.midias?.map(m => m.url) ?? [],
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error("Erro em listarSubmissoesParaValidacao:", err);
    return res.status(500).json({ message: "Erro ao buscar submissões" });
  }
}


/**
 * Valida uma submissão (aprovar/reprovar) e credita pontos em PontuacaoAtleta (upsert).
 * POST /treinos/submissoes/:id/validar  { aprovado: boolean, pontos?: number }
 */
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

    // Checagem de autorização: precisa ser entidade vinculada ao atleta OU dona do treino programado
    const resolved = await resolveEntidade(tipoUsuarioId || req.userId!);
    if (!resolved) return res.status(403).json({ message: "Sem permissão" });

    // Vinculo direto com atleta?
    const vinculo = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId: sub.atletaId,
        ...(resolved.tipo === "professor" ? { professorId: resolved.id } :
           resolved.tipo === "clube"     ? { clubeId: resolved.id } :
                                          { escolinhaId: resolved.id }),
      },
      select: { id: true },
    });

    // Ou dono do treino?
    const donoTreino = sub.treinoAgendado?.treinoProgramado && (
      sub.treinoAgendado.treinoProgramado.professorId === resolved.id ||
      sub.treinoAgendado.treinoProgramado.clubeId === resolved.id ||
      sub.treinoAgendado.treinoProgramado.escolinhaId === resolved.id
    );

    if (!vinculo && !donoTreino) {
      return res.status(403).json({ message: "Você não possui vínculo/direito para validar esta submissão." });
    }

    const pontosBase = sub.pontuacaoSnapshot ?? sub.treinoAgendado?.treinoProgramado?.pontuacao ?? 0;
    const pontosFinais = aprovado ? Math.max(0, Number.isFinite(Number(pontos)) ? Number(pontos) : (pontosBase || 0)) : 0;

    // Atualiza submissão
    const atualizado = await prisma.submissaoTreino.update({
      where: { id: sub.id },
      data: {
        aprovado,
        pontosCreditados: pontosFinais || null,
        pontuacaoSnapshot: pontosFinais || null,
        treinoTituloSnapshot: sub.treinoAgendado?.treinoProgramado?.nome ?? sub.treinoAgendado?.titulo ?? undefined,
        tipoTreinoSnapshot: sub.treinoAgendado?.treinoProgramado?.tipoTreino ?? undefined,
        duracaoMinutos: sub.treinoAgendado?.treinoProgramado?.duracao ?? undefined,
        usuarioId: req.userId!, // quem validou
      },
    });

    // Upsert em PontuacaoAtleta (garante criação caso não exista)
    await prisma.pontuacaoAtleta.upsert({
      where: { atletaId: sub.atletaId },
      create: {
        atletaId: sub.atletaId,
        pontuacaoTotal: pontosFinais,
        ultimaAtualizacao: new Date(),
      },
      update: {
        pontuacaoTotal: { increment: pontosFinais },
        ultimaAtualizacao: new Date(),
      },
    });

    // Recalcula agregados (seu serviço atual já contempla isso)
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

