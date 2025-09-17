import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { getIO } from "../socket.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";

const prisma = new PrismaClient();

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
        treinoProgramado: {
          include: { exercicios: { include: { exercicio: true } } },
        },
      },
    });

    await notificarNovoTreino(deUsuarioId, atletaId, novo.id, novo.titulo ?? tp.nome);

    return res.status(201).json(novo);
  } catch (error) {
    console.error("Erro ao agendar treino:", error);
    return res.status(500).json({ message: "Erro ao agendar treino." });
  }
}

export async function criarTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      nome,
      descricao,
      nivel,
      categoria = [],
      tipoTreino,
      objetivo,
      duracao,
      dataTreino,        
      dicas = [],
      exercicios = [],
      atletasIds = [],
    } = req.body as any;

    const criadorId = req.userId!;

    const treino = await prisma.treinoProgramado.create({
      data: {
        codigo: `${nome}-${Date.now()}`,
        nome,
        descricao,
        nivel,
        categoria,
        tipoTreino,
        objetivo,
        duracao,
        dicas,
        exercicios: {
          create: (exercicios as any[]).map((ex: any, i: number) => ({
            ordem: ex.ordem ?? i + 1,
            repeticoes: ex.repeticoes ?? "",
            exercicio: ex.exercicioId
              ? { connect: { id: ex.exercicioId } }
              : { create: { nome: ex.nome || `Exercício ${i + 1}`, codigo: `AUTO-${Date.now()}-${i}`, nivel: "Base", categorias: [] } },
          })),
        },
      },
    });

    const prazo = dataTreino ? new Date(dataTreino) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    for (const atletaId of atletasIds as string[]) {
      const ag = await prisma.treinoAgendado.create({
        data: {
          atletaId,
          treinoProgramadoId: treino.id,
          titulo: nome,
          dataTreino: prazo,
          dataExpiracao: prazo,
        },
      });
      await notificarNovoTreino(criadorId, atletaId, ag.id, nome);
    }

    res.status(201).json(treino);
  } catch (e) {
    console.error("Erro ao criar treino:", e);
    res.status(500).json({ message: "Erro ao criar treino." });
  }
}

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

export async function listarTodosTreinosProgramados(req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await prisma.treinoProgramado.findMany({
      include: {
        exercicios: { include: { exercicio: true } },
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
        exercicio: { nome: x.exercicio?.nome ?? "" },
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

export const excluirTreinoAgendado = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.treinoAgendado.deleteMany({
      where: { id },
    });

    res.status(200).json({ message: "Treino agendado deletado (ou já estava deletado)." });
  } catch (error) {
    console.error("Erro ao deletar treino agendado:", error);
    res.status(500).json({ error: "Erro ao excluir treino agendado." });
  }
};

export const treinosController = {
 async disponiveis(req: AuthenticatedRequest, res: Response) {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: {
        exercicios: {
          include: {
            exercicio: true
          }
        }
      },
    });

    const resposta = treinos.map(treino => ({
      id: treino.id,
      nome: treino.nome,
      descricao: treino.descricao,
      nivel: treino.nivel,
      duracao: treino.duracao,
      objetivo: treino.objetivo,
      dicas: treino.dicas,
      exercicios: treino.exercicios.map(e => ({
        id: e.exercicio.id,
        nome: e.exercicio.nome,
        repeticoes: e.repeticoes
      }))
    }));

    res.json(resposta);
  } catch (error) {
    console.error("Erro ao buscar treinos disponíveis:", error);
    res.status(500).json({ message: "Erro ao buscar treinos disponíveis", error });
  }
},

  async dashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const treinos = await prisma.treinoProgramado.findMany({
        include: {
          exercicios: {
            include: { exercicio: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(treinos);
    } catch (error) {
      res.status(500).json({
        message: "Erro ao carregar os treinos programados.",
        error,
      });
    }
  },
};

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
          },
        },
      },
    });
    if (!treino) return res.status(404).json({ message: "Treino não encontrado" });
    res.json(treino);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar treino programado" });
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

export async function atletasVinculados(req: Request, res: Response) {
  const tipoUsuarioId = String(req.query.tipoUsuarioId ?? "");
  const incluirPontuacao = String(req.query.incluirPontuacao ?? "0") === "1";
  if (!tipoUsuarioId) return res.json([]);

  const atletas = await prisma.atleta.findMany({
    where: { clubeId: tipoUsuarioId },
    select: { id: true, usuarioId: true, nome: true, foto: true, posicao: true, idade: true, categoria: true },
  });

  let itens = atletas.map(a => ({
    id: a.usuarioId,
    atletaId: a.id,
    nome: a.nome ?? "",
    foto: a.foto ?? null,
    posicao: a.posicao ?? null,
    idade: a.idade ?? null,
    categoria: (a.categoria && a.categoria.length) ? a.categoria[0] : null,
    pontuacao: null as number | null,
  }));

  if (incluirPontuacao && itens.length) {
    const ids = itens.map(i => i.atletaId);

    const pa = await prisma.pontuacaoAtleta.findMany({
      where: { atletaId: { in: ids } },
      select: { atletaId: true, pontuacaoTotal: true },
    });
    const mapPA = new Map(pa.map(p => [p.atletaId, p.pontuacaoTotal ?? 0]));
    itens = itens.map(i => ({ ...i, pontuacao: mapPA.get(i.atletaId) ?? null }));

    const faltando = itens.filter(i => i.pontuacao == null).map(i => i.atletaId);
    if (faltando.length) {
      const ea = await prisma.estatisticaAtleta.findMany({
        where: { atletaId: { in: faltando } },
        select: { atletaId: true, totalPontos: true },
      });
      const mapEA = new Map(ea.map(e => [e.atletaId, e.totalPontos ?? 0]));
      itens = itens.map(i => ({ ...i, pontuacao: i.pontuacao ?? mapEA.get(i.atletaId) ?? 0 }));
    }
  }

  res.json(itens);
}
