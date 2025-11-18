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

function toDTO(a: any) {
  if (!a) return null;
  return {
    id: a.id,
    plano: a.plano,
    startsAt: a.startsAt?.toISOString?.() ?? a.startsAt,
    canceledAt: a.canceledAt ? (a.canceledAt.toISOString?.() ?? a.canceledAt) : null,
    ativo: !!a.ativo,
  };
}

export async function getByUsuario(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
    res.json(toDTO(a));
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao buscar assinatura");
  }
}

export async function updatePlano(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const { plano } = req.body || {};
    if (!plano) return res.status(400).send("Informe o plano (FREE | PRO | ORG).");

    const updated = await prisma.assinatura.upsert({
      where: { usuarioId },
      update: { plano: String(plano).toUpperCase() },
      create: { usuarioId, plano: String(plano).toUpperCase(), ativo: true, startsAt: new Date(), canceledAt: null },
    });

    res.json(toDTO(updated));
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao atualizar plano");
  }
}

export async function cancelar(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const exists = await prisma.assinatura.findUnique({ where: { usuarioId } });
    if (!exists) return res.status(404).send("Assinatura não encontrada.");

    const upd = await prisma.assinatura.update({
      where: { usuarioId },
      data: { ativo: false, canceledAt: new Date() },
    });
    res.json(toDTO(upd));
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao cancelar assinatura");
  }
}

export async function reativar(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;

    const exists = await prisma.assinatura.findUnique({ where: { usuarioId } });
    let out;
    if (exists) {
      out = await prisma.assinatura.update({
        where: { usuarioId },
        data: { ativo: true, canceledAt: null },
      });
    } else {
      out = await prisma.assinatura.create({
        data: { usuarioId, plano: "FREE", startsAt: new Date(), ativo: true, canceledAt: null },
      });
    }
    res.json(toDTO(out));
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro ao reativar assinatura");
  }
}
