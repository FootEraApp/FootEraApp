import type { Response } from "express";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";


function assertAdmin(req: AuthenticatedRequest) {
  const u: any = req.user || {};
  const tipo = String(u.tipo || u.tipoUsuario || "").toLowerCase();
  const isAdmin =
    (!!u.id && tipo === "admin") ||
    u.isAdmin === true ||
    String(u.role || "").toLowerCase() === "admin";

  if (!isAdmin) {
    const err: any = new Error("Acesso restrito ao administrador.");
    err.status = 403;
    throw err;
  }
}

function toDTO(a: any) {
  if (!a) return null;
  return {
    id: a.id,
    plano: a.plano,
    startsAt: a.startsAt?.toISOString?.() ?? a.startsAt,
    canceledAt: a.canceledAt
      ? a.canceledAt.toISOString?.() ?? a.canceledAt
      : null,
    ativo: !!a.ativo,
  };
}

export async function getByUsuario(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
    res.json(toDTO(a));
  } catch (e: any) {
    console.error("erro getByUsuario:", e);
    res
      .status(e.status || 500)
      .send(e.message || "Erro ao buscar assinatura");
  }
}

export async function updatePlano(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const { plano } = req.body || {};
    if (!plano)
      return res
        .status(400)
        .send("Informe o plano (FREE | PRO | ORG).");

    const startsAt = new Date();
    const renovaEm = new Date(startsAt);
    renovaEm.setMonth(renovaEm.getMonth() + 1);

    const updated = await prisma.assinatura.upsert({
      where: { usuarioId },
      update: { plano: String(plano).toUpperCase() },
      create: {
        usuarioId,
        plano: String(plano).toUpperCase(),
        ativo: true,
        startsAt,
        canceledAt: null,
        periodicidade: "Mensal",
        renovaEm,
      },
    });

    res.json(toDTO(updated));
  } catch (e: any) {
    console.error("erro updatePlano:", e);
    res
      .status(e.status || 500)
      .send(e.message || "Erro ao atualizar plano");
  }
}

export async function cancelar(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const exists = await prisma.assinatura.findUnique({
      where: { usuarioId },
    });
    if (!exists) return res.status(404).send("Assinatura não encontrada.");

    const upd = await prisma.assinatura.update({
      where: { usuarioId },
      data: { ativo: false, canceledAt: new Date() },
    });
    res.json(toDTO(upd));
  } catch (e: any) {
    console.error("erro cancelar:", e);
    res
      .status(e.status || 500)
      .send(e.message || "Erro ao cancelar assinatura");
  }
}

export async function reativar(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;

    const exists = await prisma.assinatura.findUnique({
      where: { usuarioId },
    });
    let out;
    if (exists) {
      out = await prisma.assinatura.update({
        where: { usuarioId },
        data: { ativo: true, canceledAt: null },
      });
    } else {
      const startsAt = new Date();
      const renovaEm = new Date(startsAt);
      renovaEm.setMonth(renovaEm.getMonth() + 1);

      out = await prisma.assinatura.create({
        data: {
          usuarioId,
          plano: "FREE",
          startsAt,
          renovaEm,
          periodicidade: "Mensal",
          ativo: true,
          canceledAt: null,
        },
      });
    }
    res.json(toDTO(out));
  } catch (e: any) {
    console.error("erro reativar:", e);
    res
      .status(e.status || 500)
      .send(e.message || "Erro ao reativar assinatura");
  }
}
