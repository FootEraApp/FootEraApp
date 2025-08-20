import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

export async function agendarTreino(req: AuthenticatedRequest, res: Response) {
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

export async function getTreinosAgendados(req: Request, res: Response) {
  const atletaId = String(req.query.tipoUsuarioId ?? "");
  if (!atletaId) return res.status(400).json({ error: "tipoUsuarioId obrigatório" });

  const rows = await prisma.treinoAgendado.findMany({
    where: {
      atletaId,
      submissaoTreinos: { none: {} },
    },
    include: {
      treinoProgramado: {
        include: {
          exercicios: { include: { exercicio: true } },
        },
      },
    },
    orderBy: { id: "asc" }
  });

  const list = rows.map((r) => {
    const prazo = r.dataExpiracao ?? r.treinoProgramado?.dataAgendada ?? null;

    return {
      id: r.id,
      titulo: r.titulo ?? r.treinoProgramado?.nome ?? "Treino",
      dataTreino: r.dataTreino ? r.dataTreino.toISOString() : null,
      prazoEnvio: prazo ? new Date(prazo).toISOString() : null,

      duracaoMinutos: r.treinoProgramado?.duracao ?? null,
      nivel: r.treinoProgramado?.nivel ?? null,

      treinoProgramado: r.treinoProgramado
        ? {
            descricao: r.treinoProgramado.descricao ?? null,
            objetivo: r.treinoProgramado.objetivo ?? null,
            dicas: r.treinoProgramado.dicas ?? [],
            exercicios: r.treinoProgramado.exercicios.map((x) => ({
              exercicio: {
                id: x.exercicio?.id ?? "",
                nome: x.exercicio?.nome ?? "",
              },
              repeticoes: x.repeticoes ?? "",
            })),
          }
        : null,
    };
  });

  return res.json(list);
}


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
