import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const getDesafios = async (req: Request, res: Response) => {
  const ativosOnly = req.query.ativosOnly !== "false"; 

  try {
    const desafios = await prisma.desafioOficial.findMany({
      where: ativosOnly
        ? {
            createdAt: { lte: new Date() } 
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
        aprovado: null 
      }
    });

    res.status(201).json(submissao);
  } catch (error) {
    console.error("Erro ao criar submissão:", error);
    res.status(500).json({ message: "Erro ao criar submissão." });
  }
};

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

export async function editarDesafio(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      titulo,
      descricao,
      imagemUrl,
      nivel,
      pontos,
      categoria,
      prazoSubmissao
    } = req.body;

    const dataPrazo = prazoSubmissao ? new Date(prazoSubmissao) : undefined;

    const desafio = await prisma.desafioOficial.update({
      where: { id },
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel,
        pontos: Number(pontos),
        categoria,
        prazoSubmissao: dataPrazo
      }
    });

    res.json(desafio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao editar desafio." });
  }
}

export async function excluirDesafio(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.desafioOficial.delete({ where: { id } });
  res.status(204).send();
}