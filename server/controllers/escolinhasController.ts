import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/escolinhas
export const getEscolinhas = async (_req: Request, res: Response) => {
  try {
    const escolinhas = await prisma.escolinha.findMany({
      include: {
        atletas: true,
        midias: true
      }
    });
    res.json(escolinhas);
  } catch (error) {
    console.error("Erro ao buscar escolinhas:", error);
    res.status(500).json({ message: "Erro ao buscar escolinhas." });
  }
};

// GET /api/escolinhas/:id
export const getEscolinhaById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const escolinha = await prisma.escolinha.findUnique({
      where: { id },
      include: {
        atletas: true,
        midias: true
      }
    });

    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }

    res.json(escolinha);
  } catch (error) {
    console.error("Erro ao buscar escolinha:", error);
    res.status(500).json({ message: "Erro ao buscar escolinha." });
  }
};

// POST /api/escolinhas
export const createEscolinha = async (req: Request, res: Response) => {
  try {
    const novaEscolinha = await prisma.escolinha.create({
      data: req.body
    });

    res.status(201).json(novaEscolinha);
  } catch (error) {
    console.error("Erro ao criar escolinha:", error);
    res.status(500).json({ message: "Erro ao criar escolinha." });
  }
};

// PUT /api/escolinhas/:id
export const updateEscolinha = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const escolinha = await prisma.escolinha.findUnique({ where: { id } });

    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }

    const atualizada = await prisma.escolinha.update({
      where: { id },
      data: req.body
    });

    res.json(atualizada);
  } catch (error) {
    console.error("Erro ao atualizar escolinha:", error);
    res.status(500).json({ message: "Erro ao atualizar escolinha." });
  }
};

// DELETE /api/escolinhas/:id
export const deleteEscolinha = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const escolinha = await prisma.escolinha.findUnique({ where: { id } });

    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }

    await prisma.escolinha.delete({ where: { id } });

    res.json({ message: "Escolinha excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar escolinha:", error);
    res.status(500).json({ message: "Erro ao deletar escolinha." });
  }
};
