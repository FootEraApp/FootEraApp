import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const treinosLivresController = {
  // Lista todos os treinos livres ou filtra por atletaId
  async index(req: Request, res: Response) {
    try {
      const atletaId = req.query.atletaId as string | undefined;

      const treinos = await prisma.treinoLivre.findMany({
        where: atletaId ? { atletaId } : undefined,
        include: { atleta: true },
        orderBy: { data: "desc" },
      });

      res.json(treinos);
    } catch (err) {
      res.status(500).json({ message: "Erro ao listar treinos livres", error: err });
    }
  },

  // Busca treino livre por ID
  async show(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const treino = await prisma.treinoLivre.findUnique({
        where: { id },
        include: { atleta: true },
      });

      if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

      res.json(treino);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar treino", error: err });
    }
  },

  // Cria novo treino livre
  async create(req: Request, res: Response) {
    try {
      const { atletaId, data, descricao, duracaoMin, tipoAtividade, urlEvidencia } = req.body;

      // Simulação (o correto seria obter atletaId do JWT, por exemplo)
      const atletaExiste = await prisma.atleta.findUnique({ where: { id: atletaId } });
      if (!atletaExiste) return res.status(400).json({ message: "Atleta inválido" });

      const novo = await prisma.treinoLivre.create({
        data: {
          atletaId,
          data: new Date(data),
          descricao,
          duracaoMin
        },
      });

      res.status(201).json(novo);
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar treino", error: err });
    }
  },

  // Deleta treino livre
  async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);

      const treino = await prisma.treinoLivre.findUnique({ where: { id } });
      if (!treino) return res.status(404).json({ message: "Treino não encontrado" });

      await prisma.treinoLivre.delete({ where: { id } });

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao deletar treino", error: err });
    }
  },
};
