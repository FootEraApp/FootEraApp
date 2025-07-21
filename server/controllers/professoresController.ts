import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadPath = path.join(__dirname, "..", "uploads", "fotos");
fs.mkdirSync(uploadPath, { recursive: true });

export const createProfessor = async (req: Request, res: Response) => {
  const { codigo, nome, cref, areaFormacao, qualificacoes, certificacoes, usuarioId } = req.body;

  const qualificacoesArr = JSON.parse(qualificacoes || "[]");
  const certificacoesArr = JSON.parse(certificacoes || "[]");

  const fotoUrl = req.file ? `/uploads/fotos/${req.file.filename}` : null;

  try {
    const professor = await prisma.professor.create({
      data: {
        codigo,
        nome,
        cref,
        areaFormacao,
        fotoUrl,
        usuario: { connect: { id: usuarioId } },
        qualificacoes: qualificacoesArr,
        certificacoes: certificacoesArr,
      },
    });
    res.status(201).json(professor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar professor." });
  }
};

export const updateProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { codigo, cref, areaFormacao, escola, qualificacoes, certificacoes, fotoUrl, nome } = req.body;

  try {
    const updated = await prisma.professor.update({
      where: { id },
      data: {
        codigo,
        cref,
        areaFormacao,
        escola,
        qualificacoes,
        certificacoes,
        fotoUrl,
        nome,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar professor." });
  }
};

export const deleteProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.professor.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar professor." });
  }
};

export const getProfessores = async (req: Request, res: Response) => {
  try {
    const professores = await prisma.professor.findMany({
      include: { usuario: true },
    });
    res.json(professores);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar professores." });
  }
};