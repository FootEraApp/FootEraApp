import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export const rankingController = {
  async index(req: Request, res: Response) {
    try {
      const rankings = await prisma.ranking.findMany({
        orderBy: { total: "desc" },
        include: {
          atleta: {
            include: {
              usuario: true
            }
          }
        }
      });
      res.json(rankings);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar ranking", details: err });
    }
  }
};
