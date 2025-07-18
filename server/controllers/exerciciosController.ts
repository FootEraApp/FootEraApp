import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Nivel } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = path.join(__dirname, "..", "uploads", "videos");
fs.mkdirSync(uploadPath, { recursive: true });

export const createExercicio = async (req: Request, res: Response) => {
  const { codigo, nome, descricao, nivel, categorias } = req.body;

  let videoDemonstrativoUrl = null;
  if (req.file) {
    videoDemonstrativoUrl = `/uploads/videos/${req.file.filename}`;
  }

  try {
    const exercicio = await prisma.exercicio.create({
      data: {
        codigo,
        nome,
        descricao,
        nivel: nivel as Nivel,
        categorias: categorias ? JSON.parse(categorias) : [],
        videoDemonstrativoUrl,
      },
    });
    res.status(201).json(exercicio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar exercício." });
  }
};

export const updateExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { codigo, nome, descricao, nivel, categorias, videoDemonstrativoUrl } = req.body;

  try {
    const updated = await prisma.exercicio.update({
      where: { id },
      data: {
        codigo,
        nome,
        descricao,
        nivel,
        categorias,
        videoDemonstrativoUrl,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar exercício." });
  }
};

export const deleteExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.exercicio.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir exercício." });
  }
};

export const getExercicioById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const exercicio = await prisma.exercicio.findUnique({
      where: { id },
    });

    if (!exercicio) {
      return res.status(404).json({ error: "Exercício não encontrado." });
    }

    res.json(exercicio);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar exercício." });
  }
}
