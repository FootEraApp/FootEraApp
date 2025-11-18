// server/controllers/adminAuditController.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function listAuditLogs(req: Request, res: Response) {
  const { usuarioId, acao, page = 1, pageSize = 50 } = req.query as any;
  const take = Math.min(Number(pageSize) || 50, 200);
  const skip = (Number(page) - 1) * take;

  const where: any = {};
  if (usuarioId) where.usuarioId = String(usuarioId);
  if (acao) where.acao = String(acao);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ items, total, page: Number(page), pageSize: take });
}