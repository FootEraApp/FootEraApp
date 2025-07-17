import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const buscarExplorar = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    const termo = q ? String(q).toLowerCase() : "";

    const [atletas, clubes, escolas, desafios, professores] = await Promise.all([
      prisma.atleta.findMany({
        where: {
          usuario: { nome: { contains: termo, mode: "insensitive" } }
        },
        include: { usuario: true }
      }),
      prisma.clube.findMany({
        where: {
          nome: { contains: termo, mode: "insensitive" }
        }
      }),
      prisma.escolinha.findMany({
        where: {
          nome: { contains: termo, mode: "insensitive" }
        }
      }),
      prisma.desafioOficial.findMany({
        where: {
          titulo: { contains: termo, mode: "insensitive" }
        }
      }),
      prisma.professor.findMany({
        where: {
          usuario: { nome: { contains: termo, mode: "insensitive" } }
        },
        include: { usuario: true }
      })
    ]);

    res.json({ atletas, clubes, escolas, desafios, professores });
  } catch (error) {
    console.error("Erro em /api/explorar:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};
