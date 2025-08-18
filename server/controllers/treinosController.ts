import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

export async function getTreinosAgendados(req: Request, res: Response) {
  const atletaId = String(req.query.tipoUsuarioId ?? "");
  if (!atletaId) return res.status(400).json({ error: "tipoUsuarioId obrigatório" });

  const agora = new Date();

  const rows = await prisma.treinoAgendado.findMany({
    where: {
      atletaId,
      submissaoTreinos: { none: {} },
    },
    include: {
      treinoProgramado: {
        select: { nome: true, duracao: true, createdAt: true, dataAgendada: true }
      }
    },
    orderBy: { id: "asc" }
  });

  const list = rows
    .map((r) => {
      const prazoEnvio =
        r.dataExpiracao ?? r.treinoProgramado?.dataAgendada ?? null; 
      const expirado = prazoEnvio ? new Date(prazoEnvio).getTime() < agora.getTime() : false;

      return {
        id: r.id,
        titulo: r.titulo ?? r.treinoProgramado?.nome ?? "Treino",
        dataTreino: r.treinoProgramado?.createdAt?.toISOString() ?? null,
        prazoEnvio: prazoEnvio ? new Date(prazoEnvio).toISOString() : null,
        duracaoMinutos: r.treinoProgramado?.duracao ?? null,
        expirado,
      };
    })
    .filter((t) => !t.expirado)
    .sort((a, b) =>
      new Date(a.prazoEnvio ?? a.dataTreino ?? 0).getTime() -
      new Date(b.prazoEnvio ?? b.dataTreino ?? 0).getTime()
    );

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
      categoria: t.categoria ?? [], // enum[]
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
        dataExpiracao: new Date(dataTreino),
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
