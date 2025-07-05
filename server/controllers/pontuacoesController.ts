import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/atletas/:atletaId/pontuacao
export const getPontuacaoAtleta = async (req: Request, res: Response) => {
  const atletaId = req.params.atletaId;

  const atleta = await prisma.atleta.findUnique({ where: { id: atletaId } });
  if (!atleta) return res.status(404).json({ message: "Atleta não encontrado." });

  let pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId } });

  if (!pontuacao) {
    pontuacao = await prisma.pontuacaoAtleta.create({
      data: { atletaId },
    });
  }

  return res.json(pontuacao);
};

// PUT /api/atletas/:atletaId/pontuacao
export const atualizarPontuacaoAtleta = async (req: Request, res: Response) => {
  const atletaId = req.params.atletaId;
  const {
    pontuacaoTotal,
    pontuacaoPerformance,
    pontuacaoDisciplina,
    pontuacaoResponsabilidade
  } = req.body;

  const pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId } });

  if (!pontuacao) {
    return res.status(404).json({ message: "Pontuação não encontrada para este atleta." });
  }

  await prisma.pontuacaoAtleta.update({
    where: { atletaId },
    data: {
      pontuacaoTotal,
      pontuacaoPerformance,
      pontuacaoDisciplina,
      pontuacaoResponsabilidade,
      ultimaAtualizacao: new Date(),
    }
  });

  return res.status(204).end();
};

// GET /api/ranking?categoria=Sub15&regiao=ES
export const getRanking = async (req: Request, res: Response) => {
  try {
    const { categoria, regiao } = req.query;

    let query = prisma.pontuacaoAtleta.findMany({
      include: { atleta: true },
      orderBy: { pontuacaoTotal: "desc" }
    });

    // Filtros a implementar futuramente:
    // - categoria: atleta.categoria.includes()
    // - regiao: atleta.estado, cidade, etc.

    const ranking = await query;
    res.json(ranking);
  } catch (err) {
    console.error("Erro ao buscar ranking:", err);
    res.status(500).json({ message: "Erro interno." });
  }
};
