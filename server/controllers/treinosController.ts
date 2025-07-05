import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const treinosController = {
  async dashboard(req: Request, res: Response) {
    try {
      const treinos = await prisma.treinoProgramado.findMany({
        include: {
          exercicios: {
            include: { exercicio: true }, // Assumindo que o nome da relação é `exercicio`
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(treinos);
    } catch (error) {
      res.status(500).json({
        message: "Erro ao carregar os treinos programados.",
        error,
      });
    }
  },
};
