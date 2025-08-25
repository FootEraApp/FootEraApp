import { Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function agendarTreino(req: Request, res: Response) {
  try {
    const {
      treinoProgramadoId,
      dataTreino,
      dataExpiracao,
      titulo,
      atletaId: atletaIdBody,
      tipoUsuarioId, 
    } = req.body;

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
          include: {
            exercicios: { include: { exercicio: true } },
          },
        },
      },
    });

    return res.json(novo);
  } catch (error) {
    console.error("Erro ao agendar treino:", error);
    return res.status(500).json({ message: "Erro ao agendar treino." });
  }
}

export const getTreinosAgendados: RequestHandler = async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const authUserId = (req as any).userId as string | undefined;

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

      if (usuario.atleta) {
        where.atletaId = usuario.atleta.id;
      } else if (usuario.professor) {
        where.treinoProgramado = { professorId: usuario.professor.id };
      } else if (usuario.clube) {
        where.treinoProgramado = { clubeId: usuario.clube.id };
      } else if (usuario.escolinha) {
        where.treinoProgramado = { escolinhaId: usuario.escolinha.id };
      } else {
        return res.json([]);
      }
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
};

export async function listarTodosTreinosProgramados(req: Request, res: Response) {
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

export const excluirTreinoAgendado = async (req: Request, res: Response) => {
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
 async disponiveis(req: Request, res: Response) {
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

  async dashboard(req: Request, res: Response) {
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

export async function obterTreinoProgramadoPorId(req: Request, res: Response) {
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

export async function concluirTreino(req: Request, res: Response) {
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

    res.json({ ok: true, pontos: pontosFinais, submissao: sub });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao concluir treino" });
  }
}