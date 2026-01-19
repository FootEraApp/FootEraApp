import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "server/middlewares/auth.js";


export async function getRanking(req: AuthenticatedRequest, res: Response) {
  const categoria = (req.query.categoria as string) || "";
  const estado = (req.query.estado as string) || "";
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const meAtletaId = (req.query.meAtletaId as string) || "";

  const whereAtleta: any = {};
  if (categoria) whereAtleta.categoria = { has: categoria as any };

  const base = await prisma.atleta.findMany({
    where: whereAtleta,
    select: {
      id: true, usuarioId: true, nome: true, foto: true, categoria: true,
      usuario: { select: { estado: true, nome: true, foto: true } },
      pontuacao: { select: { pontuacaoTotal: true } },
      pontosTotal: true,
    },
  });

  const rows = base
    .filter(a => !estado || a.usuario?.estado === estado)
    .map(a => ({
      atletaId: a.id,
      nome: a.nome || a.usuario?.nome || "",
      foto: a.foto || a.usuario?.foto || null,
      estado: a.usuario?.estado || null,
      categoriaAtual: Array.isArray(a.categoria) && a.categoria.length ? a.categoria[a.categoria.length - 1] : null,
      pontuacao: a.pontuacao?.pontuacaoTotal ?? (a as any).pontosTotal ?? 0,
    }))
    .sort((x, y) => (y.pontuacao || 0) - (x.pontuacao || 0));

  const total = rows.length;
  const items = rows.slice(offset, offset + limit);

  const meIndex = meAtletaId ? rows.findIndex(r => r.atletaId === meAtletaId) : -1;

  res.json({ items, total, limit, offset, me: meIndex >= 0 ? { posicao: meIndex + 1 } : null });
}

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
