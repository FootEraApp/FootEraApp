// server/controllers/professorController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

export const getProfessores = async (req: Request, res: Response) => {
  try {
    const professores = await prisma.professor.findMany();
    res.json(professores);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar professores." });
  }
};

export const createProfessor = async (req: Request, res: Response) => {
  try {
    const { codigo, cref, areaFormacao, escola, qualificacoes, certificacoes, nome, usuarioId } = req.body;
    let fotoUrl = undefined;

    if (req.file) {
      const filename = uuidv4() + path.extname(req.file.originalname);
      const dest = path.join("uploads", "professores");
      fs.mkdirSync(dest, { recursive: true });

      const filePath = path.join(dest, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      fotoUrl = `/uploads/professores/${filename}`;
    }

    const professor = await prisma.professor.create({
      data: {
        codigo,
        cref,
        areaFormacao,
        escola,
        qualificacoes,
        certificacoes,
        fotoUrl,
        nome,
        usuarioId,
      },
    });

    res.status(201).json(professor);
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar professor." });
  }
};

export const updateProfessor = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const { cref, areaFormacao, escola, qualificacoes, certificacoes } = req.body;

    let fotoUrl = undefined;
    if (req.file) {
      const filename = uuidv4() + path.extname(req.file.originalname);
      const dest = path.join("uploads", "professores");
      fs.mkdirSync(dest, { recursive: true });

      const filePath = path.join(dest, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      fotoUrl = `/uploads/professores/${filename}`;
    }

    const updated = await prisma.professor.update({
      where: { id },
      data: {
        cref,
        areaFormacao,
        escola,
        qualificacoes,
        certificacoes,
        ...(fotoUrl ? { fotoUrl } : {})
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar professor." });
  }
};

export const deleteProfessor = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    await prisma.professor.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir professor." });
  }
};

export const getProfessorById = async (req: Request, res: Response) => {
  try {
    const professor = await prisma.professor.findUnique({ where: { id: req.params.id } });
    if (!professor) return res.status(404).json({ message: "Professor não encontrado." });
    res.json(professor);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar professor." });
  }
};
