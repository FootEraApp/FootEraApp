import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "server/middlewares/auth";

export const listarTreinosAgendados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tipoUsuarioId } = req.query;

    if (!tipoUsuarioId) {
      return res.status(400).json({ message: "tipoUsuarioId é obrigatório" });
    }

    const treinos = await prisma.treinoAgendado.findMany({
      where: {
        atletaId: String(tipoUsuarioId),
      },
      include: {
        treinoProgramado: {
          include: {
            exercicios: {
              include: {
                exercicio: true
              }
            }
          }
        }
      },
      orderBy: { dataTreino: 'asc' }
    });

    res.json(treinos);
  } catch (error) {
    console.error("Erro ao listar treinos agendados:", error);
    res.status(500).json({ message: "Erro interno ao buscar treinos." });
  }
};

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
  // server/controllers/treinosController.ts
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

