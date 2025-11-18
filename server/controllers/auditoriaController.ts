import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';

const prisma = new PrismaClient();

async function isAdmin(usuarioId: string) {
  const a = await prisma.administrador.findUnique({ where: { usuarioId } });
  return !!a;
}

export async function listarAuditoria(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.id || (req as any).userId;
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });
  if (!(await isAdmin(userId))) return res.status(403).json({ code: 'FORBIDDEN' });

  const { desde, ate, acao, usuarioId, limit = '200' } = req.query as any;

  const where: any = {};
  if (acao) where.acao = String(acao);
  if (usuarioId) where.usuarioId = String(usuarioId);
  if (desde || ate) where.createdAt = {
    ...(desde ? { gte: new Date(String(desde)) } : {}),
    ...(ate ? { lte: new Date(String(ate)) } : {}),
  };

  const rows = await prisma.logAuditoria.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(parseInt(String(limit) || '200', 10), 1000),
  });

  return res.json(rows);
}
