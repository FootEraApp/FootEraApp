import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/clubes
export const getClubes = async (_req: Request, res: Response) => {
  try {
    const clubes = await prisma.clube.findMany();
    res.json(clubes);
  } catch (error) {
    console.error("Erro ao buscar clubes:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// GET /api/clubes/:id
export const getClube = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clube = await prisma.clube.findUnique({
      where: { id },
      include: {
        atletas: true,
        midias: true,
        postagens: true
      }
    });

    if (!clube) {
      return res.status(404).json({ message: "Clube não encontrado." });
    }

    res.json(clube);
  } catch (error) {
    console.error("Erro ao buscar clube:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// POST /api/clubes
export const createClube = async (req: Request, res: Response) => {
  try {
    const { usuarioId, nome, cnpj, telefone1, telefone2, email, siteOficial, sede, estadio, logradouro, numero, complemento, bairro, cidade, estado, pais, cep, logo } = req.body;

    const clube = await prisma.clube.create({
      data: {
        usuarioId,
        nome,
        cnpj,
        telefone1,
        telefone2,
        email,
        siteOficial,
        sede,
        estadio,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        pais,
        cep,
        logo
      }
    });

    res.status(201).json(clube);
  } catch (error) {
    console.error("Erro ao criar clube:", error);
    res.status(500).json({ message: "Erro interno ao criar clube." });
  }
};

// PUT /api/clubes/:id
export const updateClube = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clubeExistente = await prisma.clube.findUnique({ where: { id } });

    if (!clubeExistente) {
      return res.status(404).json({ message: "Clube não encontrado." });
    }

    const clubeAtualizado = await prisma.clube.update({
      where: { id },
      data: req.body
    });

    res.json(clubeAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar clube:", error);
    res.status(500).json({ message: "Erro ao atualizar clube." });
  }
};

// DELETE /api/clubes/:id
export const deleteClube = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clubeExistente = await prisma.clube.findUnique({ where: { id } });

    if (!clubeExistente) {
      return res.status(404).json({ message: "Clube não encontrado." });
    }

    await prisma.clube.delete({ where: { id } });

    res.json({ message: "Clube deletado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar clube:", error);
    res.status(500).json({ message: "Erro ao deletar clube." });
  }
};
