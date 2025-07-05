import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/desafios
export const getDesafios = async (req: Request, res: Response) => {
  const ativosOnly = req.query.ativosOnly !== "false"; // true por padrão

  try {
    const desafios = await prisma.desafioOficial.findMany({
      where: ativosOnly
        ? {
            createdAt: { lte: new Date() } // Adapte conforme desejar para desafio ativo
          }
        : {},
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json(desafios);
  } catch (error) {
    console.error("Erro ao buscar desafios:", error);
    res.status(500).json({ message: "Erro ao buscar desafios." });
  }
};

// GET /api/desafios/:id
export const getDesafioById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const desafio = await prisma.desafioOficial.findUnique({
      where: { id }
    });

    if (!desafio) {
      return res.status(404).json({ message: "Desafio não encontrado." });
    }

    res.json(desafio);
  } catch (error) {
    console.error("Erro ao buscar desafio:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

// POST /api/desafios/:id/submissoes
export const criarSubmissaoDesafio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { atletaId, videoUrl } = req.body;

  try {
    const desafio = await prisma.desafioOficial.findUnique({ where: { id } });
    if (!desafio) {
      return res.status(400).json({ message: "Desafio inválido ou não encontrado." });
    }

    const atleta = await prisma.atleta.findUnique({ where: { id: atletaId } });
    if (!atleta) {
      return res.status(400).json({ message: "Atleta inválido ou não encontrado." });
    }

    const submissao = await prisma.submissaoDesafio.create({
      data: {
        atletaId,
        desafioId: id,
        videoUrl,
        aprovado: null // pendente
      }
    });

    res.status(201).json(submissao);
  } catch (error) {
    console.error("Erro ao criar submissão:", error);
    res.status(500).json({ message: "Erro ao criar submissão." });
  }
};

// GET /api/desafios/:id/submissoes
export const getSubmissoesPorDesafio = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const submissoes = await prisma.submissaoDesafio.findMany({
      where: { desafioId: id },
      include: { atleta: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(submissoes);
  } catch (error) {
    console.error("Erro ao buscar submissões:", error);
    res.status(500).json({ message: "Erro ao buscar submissões." });
  }
};

// GET /api/atletas/:atletaId/submissoes
export const getSubmissoesPorAtleta = async (req: Request, res: Response) => {
  const { atletaId } = req.params;

  try {
    const submissoes = await prisma.submissaoDesafio.findMany({
      where: { atletaId },
      include: { desafio: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(submissoes);
  } catch (error) {
    console.error("Erro ao buscar submissões do atleta:", error);
    res.status(500).json({ message: "Erro ao buscar submissões." });
  }
};
