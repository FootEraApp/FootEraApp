import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const listarExercicios = async (req: Request, res: Response) => {
  try {
    const exercicios = await prisma.exercicio.findMany();
    res.json(exercicios);
  } catch (error) {
    console.error("Erro ao listar exercícios:", error);
    res.status(500).json({ message: "Erro ao listar exercícios." });
  }
};

export const buscarExercicioPorId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const exercicio = await prisma.exercicio.findUnique({
      where: { id },
    });
    if (!exercicio) return res.status(404).json({ message: "Exercício não encontrado." });
    res.json(exercicio);
  } catch (error) {
    console.error("Erro ao buscar exercício:", error);
    res.status(500).json({ message: "Erro ao buscar exercício." });
  }
};

export const criarExercicio = async (req: Request, res: Response) => {
  try {
    const novoExercicio = await prisma.exercicio.create({
      data: req.body,
    });
    res.status(201).json(novoExercicio);
  } catch (error) {
    console.error("Erro ao criar exercício:", error);
    res.status(500).json({ message: "Erro ao criar exercício." });
  }
};

export const editarExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const exercicio = await prisma.exercicio.update({
      where: { id },
      data: req.body,
    });
    res.json(exercicio);
  } catch (error) {
    console.error("Erro ao editar exercício:", error);
    res.status(500).json({ message: "Erro ao editar exercício." });
  }
};

export const excluirExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.exercicio.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir exercício:", error);
    res.status(500).json({ message: "Erro ao excluir exercício." });
  }
};
