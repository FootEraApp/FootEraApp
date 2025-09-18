import { Request, Response } from "express";
import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const exercisesVideosDir = path.join(__dirname, "..", "..", "public", "exercicios", "videos");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(exercisesVideosDir, { recursive: true });
    cb(null, exercisesVideosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-video${ext}`);
  },
});

export const uploadVideo = multer({ storage }).single("video");

const publicJoin = (p: string) =>
  path.join(__dirname, "..", "..", "public", p.replace(/^\/+/, ""));

export const criarExercicio = async (req: Request, res: Response) => {
  try {
    const { codigo, nome, descricao, nivel } = req.body;

    const categorias =
      req.body.categorias
        ? (Array.isArray(req.body.categorias)
            ? req.body.categorias
            : JSON.parse(req.body.categorias))
        : [];

    const videoDemonstrativoUrl = req.file
      ? `/exercicios/videos/${req.file.filename}`
      : null;

    const novoExercicio = await prisma.exercicio.create({
      data: {
        codigo,
        nome,
        descricao,
        nivel,
        categorias: { set: categorias },
        videoDemonstrativoUrl,
      },
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
    const { codigo, nome, descricao, nivel } = req.body;

    if (!["Base", "Avancado", "Performance"].includes(nivel)) {
      return res.status(400).json({ message: "Nível inválido" });
    }

    const exercicioAtual = await prisma.exercicio.findUnique({ where: { id } });

    const categorias =
      req.body.categorias
        ? (Array.isArray(req.body.categorias)
            ? req.body.categorias
            : JSON.parse(req.body.categorias))
        : [];

    const novaUrl = req.file ? `/exercicios/videos/${req.file.filename}` : undefined;

    if (novaUrl && exercicioAtual?.videoDemonstrativoUrl) {
      const oldAbs = publicJoin(exercicioAtual.videoDemonstrativoUrl);
      if (fs.existsSync(oldAbs)) {
        try { fs.unlinkSync(oldAbs); } catch {}
      }
    }

    const exercicio = await prisma.exercicio.update({
      where: { id },
      data: {
        codigo,
        nome,
        descricao,
        nivel,
        categorias: { set: categorias },
        ...(novaUrl && { videoDemonstrativoUrl: novaUrl }),
      },
    });

    res.json(exercicio);
  } catch (error) {
    const err = error as Error;
    console.error("Erro ao editar exercício:", err.message, err.stack);
    res.status(500).json({ message: "Erro ao editar exercício." });
  }
};

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
    const exercicio = await prisma.exercicio.findUnique({ where: { id } });
    if (!exercicio) return res.status(404).json({ message: "Exercício não encontrado." });
    res.json(exercicio);
  } catch (error) {
    console.error("Erro ao buscar exercício:", error);
    res.status(500).json({ message: "Erro ao buscar exercício." });
  }
};

export const excluirExercicio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.exercicio.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir exercício:", error);
    res.status(500).json({ message: "Erro ao excluir exercício." });
  }
};
