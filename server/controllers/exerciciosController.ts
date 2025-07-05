import { Request, Response } from "express";
import { PrismaClient, Categoria, Nivel } from "@prisma/client";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

// GET /api/exercicios
export const getExercicios = async (_req: Request, res: Response) => {
  try {
    const exercicios = await prisma.exercicio.findMany();
    res.json(exercicios);
  } catch (error) {
    console.error("Erro ao listar exercícios:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

// GET /api/exercicios/:id
export const getExercicioById = async (req: Request, res: Response) => {
  try {
    const exercicio = await prisma.exercicio.findUnique({
      where: { id: req.params.id }
    });

    if (!exercicio) {
      return res.status(404).json({ message: "Exercício não encontrado." });
    }

    res.json(exercicio);
  } catch (error) {
    console.error("Erro ao buscar exercício:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

// POST /api/exercicios
export const createExercicio = async (req: Request, res: Response) => {
  try {
    const { codigo, nome, descricao, nivel, categorias } = req.body;
    const file = (req as any).file;

    const videoUrl = file ? `/uploads/videos/${file.filename}` : undefined;

    const novoExercicio = await prisma.exercicio.create({
      data: {
        codigo,
        nome,
        descricao,
        nivel: nivel as Nivel,
        categorias: categorias as Categoria[],
        videoDemonstrativoUrl: videoUrl
      }
    });

    res.status(201).json(novoExercicio);
  } catch (error) {
    console.error("Erro ao criar exercício:", error);
    res.status(500).json({ message: "Erro interno ao criar exercício" });
  }
};

// PUT /api/exercicios/:id
export const updateExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, descricao, nivel, categorias } = req.body;
  const file = (req as any).file;

  try {
    const exercicioExistente = await prisma.exercicio.findUnique({ where: { id } });

    if (!exercicioExistente) {
      return res.status(404).json({ message: "Exercício não encontrado." });
    }

    const videoDemonstrativoUrl = file
      ? `/uploads/videos/${file.filename}`
      : exercicioExistente.videoDemonstrativoUrl;

    const atualizado = await prisma.exercicio.update({
      where: { id },
      data: {
        nome,
        descricao,
        nivel: nivel as Nivel,
        categorias: categorias as Categoria[],
        videoDemonstrativoUrl
      }
    });

    res.json(atualizado);
  } catch (error) {
    console.error("Erro ao atualizar exercício:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

// DELETE /api/exercicios/:id
export const deleteExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const exercicio = await prisma.exercicio.findUnique({ where: { id } });

    if (!exercicio) {
      return res.status(404).json({ message: "Exercício não encontrado." });
    }

    // Remover vídeo do disco (se existir)
    if (exercicio.videoDemonstrativoUrl) {
      const fullPath = path.join(__dirname, "../../public", exercicio.videoDemonstrativoUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await prisma.exercicio.delete({ where: { id } });

    res.json({ message: "Exercício deletado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar exercício:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};
