import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function assertAdmin(req: Request) {
  const u: any = (req as any).user || {};
  if (!u?.id || String(u?.tipo) !== "Admin") {
    const err: any = new Error("Acesso restrito ao administrador.");
    err.status = 403;
    throw err;
  }
}
function parseBool(v?: string) {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function listar(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const { q = "", plano = "", ativo = "", page = "1", pageSize = "20" } = req.query as Record<string, string>;

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    const where: any = {};
    if (plano) where.plano = String(plano);

    const ativoBool = parseBool(ativo);
    if (typeof ativoBool === "boolean") where.ativo = ativoBool;

    const userFilter =
      q.trim() !== ""
        ? {
            usuario: {
              OR: [
                { nome: { contains: q as string, mode: "insensitive" } },
                { nomeDeUsuario: { contains: q as string, mode: "insensitive" } },
                { email: { contains: q as string, mode: "insensitive" } },
              ],
            },
          }
        : {};

    const [total, items] = await Promise.all([
      prisma.assinatura.count({ where: { AND: [where, userFilter] } }),
      prisma.assinatura.findMany({
        where: { AND: [where, userFilter] },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              tipo: true,
              foto: true,
              dataCriacao: true,
            },
          },
        },
        orderBy: [{ startsAt: "desc" }],
        skip: (p - 1) * ps,
        take: ps,
      }),
    ]);

    res.json({ total, items, page: p, pageSize: ps });
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao listar assinantes");
  }
}

export async function overview(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const all = await prisma.assinatura.findMany({ select: { plano: true, ativo: true, canceledAt: true } });

    const total = all.length;
    const ativos = all.filter(a => a.ativo).length;
    const cancelados = all.filter(a => !a.ativo || a.canceledAt != null).length;

    const porPlano: Record<string, { total: number; ativos: number }> = {};
    for (const a of all) {
      const k = a.plano || "FREE";
      porPlano[k] ??= { total: 0, ativos: 0 };
      porPlano[k].total++;
      if (a.ativo) porPlano[k].ativos++;
    }

    res.json({ total, ativos, cancelados, porPlano });
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao calcular overview de assinaturas");
  }
}
