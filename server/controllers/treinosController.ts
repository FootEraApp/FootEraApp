import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

export async function listarTreinosAgendados(req: AuthenticatedRequest, res: Response) {
  const { tipoUsuarioId } = req.query as { tipoUsuarioId?: string };

  if (!req.userId) return res.status(401).json({ error: "Sem autenticação" });
  if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

  const agendados = await prisma.treinoAgendado.findMany({
    where: { atletaId: tipoUsuarioId },
    include: { treinoProgramado: { include: { exercicios: true } } },
    orderBy: { dataTreino: "asc" },
  });

  return res.json(
    agendados.map((t) => ({
      id: t.id,
      titulo: t.titulo ?? t.treinoProgramado?.nome ?? "Treino",
      dataTreino: t.dataTreino,
      exercicios: t.treinoProgramado?.exercicios ?? [],
      training: {
        title: t.treinoProgramado?.nome ?? t.titulo ?? "Treino",
        duration: t.treinoProgramado?.duracao ?? 0,
        category: (t.treinoProgramado?.categoria?.[0] ?? "Físico") as string,
      },
    }))
  );
}

export const listarTodosTreinosProgramados = async (req: Request, res: Response) => {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: {
        exercicios: {
          include: {
            exercicio: true
          }
        },
        professor: true,
        clube: true,
        escolinha: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(treinos);
  } catch (error) {
    console.error("Erro ao buscar treinos programados:", error);
    res.status(500).json({ message: "Erro ao buscar treinos programados" });
  }
};

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

  async agendarTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const { treinoProgramadoId, atletaId, dataTreino } = req.body;

    if (!treinoProgramadoId || !atletaId || !dataTreino) {
      return res.status(400).json({ message: "Dados incompletos." });
    }

    const treinoAgendado = await prisma.treinoAgendado.create({
      data: {
        treinoProgramadoId,
        atletaId,
        dataTreino: new Date(dataTreino),
        dataHora: new Date(dataTreino),
        titulo: "Treino Agendado",
      },
    });

    res.json(treinoAgendado);
  } catch (error) {
    res.status(500).json({ message: "Erro ao agendar treino", error });
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
