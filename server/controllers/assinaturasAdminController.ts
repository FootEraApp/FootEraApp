import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";


type AdminReq = Request & { user?: any };

function assertAdmin(req: AdminReq) {
  const u: any = req.user || {};

  if (!u || !u.id) {
    const err: any = new Error("Acesso restrito ao administrador.");
    err.status = 403;
    throw err;
  }

  const tipo = String(u.tipo || u.tipoUsuario || "").toLowerCase();
  const isAdmin =
    (!!u.id && (tipo === "admin" || tipo === "administrador")) ||
    u.isAdmin === true ||
    String(u.role || "").toLowerCase() === "admin";

  if (!isAdmin) {
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

export async function listar(req: AdminReq, res: Response) {
  try {
    assertAdmin(req);

    const {
      q = "",
      plano = "",
      tipo = "",
      ativo = "",
      ordenarPor = "nome",
      ordem = "asc",
      page = "1",
      pageSize = "20",
    } = req.query as Record<string, string>;

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const ordemFinal: "asc" | "desc" =
      String(ordem).toLowerCase() === "desc"
        ? "desc"
        : "asc";

    const ordenarPorFinal =
      String(ordenarPor || "nome")
        .trim()
        .toLowerCase();

    let orderBy: any[];

    if (ordenarPorFinal === "startsat") {
      orderBy = [
        { startsAt: ordemFinal },
        { id: "asc" },
      ];
    } else {
      orderBy = [
        { usuario: { nome: ordemFinal } },
        { usuario: { nomeDeUsuario: ordemFinal } },
        { usuario: { email: ordemFinal } },
        { id: "asc" },
      ];
    }

    const where: any = {};

    if (plano) {
      where.plano = {
        contains: String(plano).toUpperCase(),
        mode: "insensitive",
      };
    }

    const ativoBool = parseBool(ativo);
    if (typeof ativoBool === "boolean") where.ativo = ativoBool;

    const userFilter: any = {};

    const andUsuario: any[] = [];

    if (q.trim() !== "") {
      andUsuario.push({
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { nomeDeUsuario: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (tipo.trim() !== "") {
      andUsuario.push({
        tipo: String(tipo),
      });
    }

    if (andUsuario.length > 0) {
      userFilter.usuario = {
        AND: andUsuario,
      };
    }

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
        orderBy,
        skip: (p - 1) * ps,
        take: ps,
      }),
    ]);

    res.json({ total, items, page: p, pageSize: ps });
  } catch (e: any) {
    sendError(res, e, "Erro ao listar assinantes");
  }
}

export async function overview(req: AdminReq, res: Response) {
  try {
    assertAdmin(req);

    const all = await prisma.assinatura.findMany({
      select: { plano: true, ativo: true, canceledAt: true },
    });

    const total = all.length;
    const ativos = all.filter((a) => a.ativo).length;
    const cancelados = all.filter(
      (a) => !a.ativo || a.canceledAt != null
    ).length;

    const porPlano: Record<string, { total: number; ativos: number }> = {};
    for (const a of all) {
      const k = a.plano || "FREE";
      porPlano[k] ??= { total: 0, ativos: 0 };
      porPlano[k].total++;
      if (a.ativo) porPlano[k].ativos++;
    }

    res.json({ total, ativos, cancelados, porPlano });
  } catch (e: any) {
    sendError(res, e, "Erro ao calcular overview de assinaturas");
  }
}

export async function excluir(req: AdminReq, res: Response) {
  try {
    assertAdmin(req);

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "ID da assinatura é obrigatório.",
      });
    }

    const assinatura = await prisma.assinatura.findUnique({
      where: { id },
      select: {
        id: true,
        plano: true,
        ativo: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });

    if (!assinatura) {
      return res.status(404).json({
        message: "Assinatura não encontrada.",
      });
    }

    if (assinatura.ativo) {
      return res.status(400).json({
        message:
          "Não é possível excluir uma assinatura ativa. Cancele a assinatura primeiro.",
      });
    }

    await prisma.assinatura.delete({
      where: { id },
    });

    return res.json({
      ok: true,
      id: assinatura.id,
    });
  } catch (e: any) {
    console.error("erro excluir assinatura:", e);

    sendError(
      res,
      e,
      "Erro ao excluir assinatura"
    );
  }
}