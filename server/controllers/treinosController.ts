import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Nivel } from "@prisma/client";

export const createTreino = async (req: Request, res: Response) => {
  const { codigo, nome, descricao, nivel, professorId, exercicios } = req.body;

  try {
    const treino = await prisma.treinoProgramado.create({
      data: {
        codigo,
        nome,
        descricao,
        nivel: nivel as Nivel,
        professorId,
        exercicios: {
          create: exercicios.map((e: any) => ({
            exercicioId: e.exercicioId,
            ordem: Number(e.ordem),
            reps: e.reps,
          })),
        },
      },
      include: { exercicios: true },
    });
    res.status(201).json(treino);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar treino." });
  }
};

export const updateTreino = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { codigo, nome, descricao, nivel, professorId, exercicios } = req.body;

  try {
    await prisma.treinoProgramadoExercicio.deleteMany({
      where: { treinoProgramadoId: id }
    });

    const updated = await prisma.treinoProgramado.update({
      where: { id },
      data: {
        codigo,
        nome,
        descricao,
        nivel,
        professorId,
        exercicios: {
          createMany: {
            data: exercicios.map((ex: any) => ({
              exercicioId: ex.exercicioId,
              ordem: ex.ordem,
              repeticoes: ex.repeticoes,
            }))
          }
        }
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar treino." });
  }
};

export const deleteTreino = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.treinoProgramado.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir treino." });
  }
};

export const getTreinos = async (req: Request, res: Response) => {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: { exercicios: true },
    });
    res.json(treinos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar treinos." });
  }
};