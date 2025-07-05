import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const treinosProgramadosController = {
  async index(req: Request, res: Response) {
    try {
      const treinos = await prisma.treinoProgramado.findMany({
        include: {
          exercicios: {
            include: { exercicio: true },
          },
          professor: true,
        },
      });
      res.json(treinos);
    } catch (err) {
      res.status(500).json({ message: "Erro ao listar treinos", error: err });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { codigo, nome, descricao, nivel, dataAgendada, professorId, exercicios } = req.body;

      const novoTreino = await prisma.treinoProgramado.create({
        data: {
          codigo,
          nome,
          descricao,
          nivel,
          dataAgendada: dataAgendada ? new Date(dataAgendada) : null,
          professor: {
            connect: professorId ? { id: professorId } : undefined,
          },
          exercicios: {
            create: exercicios?.map((ex: any) => ({
              ordem: ex.ordem,
              repeticoes: ex.repeticoes,
              exercicio: { connect: { id: ex.exercicioId } },
            })),
          },
        },
        include: {
          professor: true,
          exercicios: true,
        },
      });

      res.status(201).json(novoTreino);
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar treino", error: err });
    }
  },

  async show(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const treino = await prisma.treinoProgramado.findUnique({
        where: { id },
        include: {
          professor: true,
          exercicios: {
            include: { exercicio: true },
          },
        },
      });

      if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

      res.json(treino);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar treino", error: err });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { codigo, nome, descricao, nivel, dataAgendada, professorId, exercicios } = req.body;

      await prisma.treinoProgramado.update({
        where: { id },
        data: {
          codigo,
          nome,
          descricao,
          nivel,
          dataAgendada: dataAgendada ? new Date(dataAgendada) : null,
          professor: {
            connect: professorId ? { id: professorId } : undefined,
          },
          exercicios: {
            deleteMany: {},
            create: exercicios?.map((ex: any) => ({
              ordem: ex.ordem,
              repeticoes: ex.repeticoes,
              exercicio: { connect: { id: ex.exercicioId } },
            })),
          },
        },
      });

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar treino", error: err });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await prisma.treinoProgramado.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir treino", error: err });
    }
  },

  async agendarTreino(req: Request, res: Response) {
    try {
      const { id, atletaId, titulo } = req.body;

      const existe = await prisma.treinoAgendado.findFirst({
        where: { id, atletaId, },
      });

      if (existe) return res.status(400).json({ message: "Treino já agendado" });

      const agendado = await prisma.treinoAgendado.create({
        data: {
          id,
          titulo,
          atletaId,
          dataHora: new Date(),
        },
      });

      res.status(201).json(agendado);
    } catch (err) {
      res.status(500).json({ message: "Erro ao agendar treino", error: err });
    }
  },

  async excluirAgendamento(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await prisma.treinoAgendado.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao cancelar agendamento", error: err });
    }
  },

  async dashboard(req: Request, res: Response) {
    try {
      const agendados = await prisma.treinoAgendado.findMany({
        include: {
          treinoProgramado: true,
          atleta: true,
        },
      });

      res.json(agendados);
    } catch (err) {
      res.status(500).json({ message: "Erro no dashboard", error: err });
    }
  },
};
