// server/controllers/treinosController.ts
import { Response, Request } from "express";
import { PrismaClient, PosicaoCampo, Categoria, TipoTreino } from "@prisma/client";
import { getIO } from "../socket.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";

const prisma = new PrismaClient();

/* ================== Utils ================== */

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

/** Resolve professor/clube/escolinha aceitando id OU usuarioId. */
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

/* ================== Core: Treinos ================== */

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
    const q = req.query as Record<string, string | undefined>;
    const authUserId = req.userId;

    const atletaIdParam = q.atletaId;
    const usuarioIdParam = q.usuarioId || authUserId || null;

    let where: any = {};
    if (atletaIdParam) {
      where.atletaId = String(atletaIdParam);
    } else if (usuarioIdParam) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: String(usuarioIdParam) },
        include: { atleta: true, professor: true, clube: true, escolinha: true },
      });
      if (!usuario) return res.json([]);

      if (usuario.atleta) where.atletaId = usuario.atleta.id;
      else if (usuario.professor) where.treinoProgramado = { professorId: usuario.professor.id };
      else if (usuario.clube) where.treinoProgramado = { clubeId: usuario.clube.id };
      else if (usuario.escolinha) where.treinoProgramado = { escolinhaId: usuario.escolinha.id };
      else return res.json([]);
    } else {
      return res.json([]);
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

/* ================== Exercícios / Utilidades ================== */

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

/* ================== Elencos ================== */

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

/* ================== Atletas vinculados (perfil) ================== */

export async function atletasVinculados(req: Request, res: Response) {
  try {
    const raw = (req.query?.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw || "").trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

    const resolved = await resolveEntidade(tipoUsuarioId);
    if (!resolved) return res.json([]);

    const atletaIds = new Set<string>();

    // Relações em RelacaoTreinamento
    const whereRel =
      resolved.tipo === "professor" ? { professorId: resolved.id } :
      resolved.tipo === "clube"     ? { clubeId: resolved.id } :
                                      { escolinhaId: resolved.id };

    const rels = await prisma.relacaoTreinamento.findMany({
      where: { ...whereRel, atletaId: { not: null } },
      select: { atletaId: true },
    });
    rels.forEach(r => r.atletaId && atletaIds.add(r.atletaId));

    // Vínculos diretos (útil para clube/escolinha)
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
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      orderBy: { nome: "asc" },
    });

    const payload = atletas.map(a => ({
      id: a.usuarioId, // para /perfil/{usuarioId}
      atletaId: a.id,
      nome: a.nome ?? a.usuario?.nome ?? "",
      foto: a.foto ?? a.usuario?.foto ?? null,
      posicao: a.posicao ?? null,
      idade: a.idade ?? null,
      altura: a.altura ?? null,
      peso: a.peso ?? null,
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao buscar atletas vinculados:", error);
    return res.status(500).json({ error: "Erro ao buscar atletas vinculados" });
  }
}

/* ================== Miscelânea ================== */

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
      atletasIds,
    } = req.body as any;

    if (!nome || !nivel || !Array.isArray(exercicios) || !usuarioId || !tipoUsuarioId) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    if (categoria && (!Array.isArray(categoria) || !categoria.every((cat: any) => Object.values(Categoria).includes(cat)))) {
      return res.status(400).json({ error: "Categoria(s) inválida(s)" });
    }

    if (tipoTreino && !Object.values(TipoTreino).includes(tipoTreino as TipoTreino)) {
      return res.status(400).json({ error: "TipoTreino inválido" });
    }

    const when = dataTreino || dataAgendada || null;
    const tipoNorm = typeof tipoUsuario === "string" ? (tipoUsuario as string).toLowerCase() : null;

    // 1) cria o treino SEM exercícios
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
        categoria: Array.isArray(categoria) ? (categoria as any[]) : [],
        tipoTreino: tipoTreino as TipoTreino,
        ...(tipoNorm === "professor"  ? { professorId: tipoUsuarioId } :
          tipoNorm === "escolinha"    ? { escolinhaId: tipoUsuarioId } :
          tipoNorm === "clube"        ? { clubeId: tipoUsuarioId } : {}),
      },
    });

    // 2) separa exercícios do banco x temporários
    const exsBanco = (exercicios as any[]).filter(e => e.exercicioId);
    const exsTemp  = (exercicios as any[]).filter(e => !e.exercicioId && e.nome);

    // 3) cria vínculos para exercícios do banco
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

    // 4) cria exercícios temporários + vínculos
    //    (usa o nivel e a(s) categoria(s) do treino como default)
    for (const [i, e] of exsTemp.entries()) {
      const temp = await prisma.exercicioTemporario.create({
        data: {
          treinoProgramadoId: treino.id,
          codigo: null,            // opcional
          nome: e.nome,
          descricao: e.descricao ?? null,
          nivel,                   // herda do treino
          categorias: Array.isArray(categoria) ? (categoria as any[]) : [],
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

    // 5) agendar para atletas selecionados (mesmo comportamento que você já tinha)
    if (Array.isArray(atletasIds) && atletasIds.length > 0) {
      const dataAgendada = treino.dataAgendada ?? new Date();
      await Promise.all(
        (atletasIds as string[]).map((atletaId) =>
          prisma.treinoAgendado.create({
            data: {
              titulo: treino.nome,
              dataExpiracao: dataAgendada,
              dataTreino: dataAgendada,
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

// --- UPDATE Treino Programado (suporta exercícios do banco e temporários) ---
export async function atualizarTreinoProgramado(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
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

    // troca de dono (desconecta todos e conecta o novo, se solicitado)
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
      // limpa vínculos e temporários anteriores
      await tx.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } });
      await tx.exercicioTemporario.deleteMany({ where: { treinoProgramadoId: id } });

      // atualiza o treino
      await tx.treinoProgramado.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(codigo !== undefined ? { codigo } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(nivel !== undefined ? { nivel } : {}),
          ...(categoria !== undefined ? { categoria: Array.isArray(categoria) ? categoria : [] } : {}),
          ...(tipoTreino !== undefined ? { tipoTreino } : {}),
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

      // recria vínculos para exercícios do banco
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

      // recria temporários + vínculos
      for (const [i, e] of exsTemp.entries()) {
        const temp = await tx.exercicioTemporario.create({
          data: {
            treinoProgramadoId: id,
            codigo: null,
            nome: e.nome,
            descricao: e.descricao ?? null,
            nivel: nivel,
            categorias: Array.isArray(categoria) ? categoria : [],
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

// --- DELETE Treino Programado (limpa vínculos e temporários) ---
export const deletarTreinoProgramado = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.treinoAgendado.deleteMany({ where: { treinoProgramadoId: id } }); // opcional
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

