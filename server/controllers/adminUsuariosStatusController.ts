import { Request, Response } from "express";
import { prisma } from "../prisma.js";

const pickUserAdminFields = (u: any) => ({
  id: u.id,
  nome: u.nome,
  nomeDeUsuario: u.nomeDeUsuario,
  email: u.email,
  tipo: u.tipo,
  status: u.status,
  blockedAt: u.blockedAt,
  blockedReason: u.blockedReason,
  deletedAt: u.deletedAt,
  reactivatedAt: u.reactivatedAt,
});

export async function bloquearUsuario(req: Request, res: Response) {
  const { id } = req.params;
  const { motivo } = req.body as { motivo?: string };

  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) return res.status(404).send("Usuário não encontrado.");

  const updated = await prisma.usuario.update({
    where: { id },
    data: {
      status: "BLOQUEADO",
      blockedAt: new Date(),
      blockedReason: motivo?.trim() || "Bloqueado pelo administrador.",
      tokenVersion: { increment: 1 }, // ✅ derruba sessão imediatamente
    },
  });

  // ✅ IMPORTANTE: devolver os campos que o frontend precisa
  return res.json({ ok: true, usuario: pickUserAdminFields(updated) });
}

export async function reativarUsuario(req: Request, res: Response) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) return res.status(404).send("Usuário não encontrado.");

  const updated = await prisma.usuario.update({
    where: { id },
    data: {
      status: "ATIVO",
      blockedAt: null,
      blockedReason: null,
      deletedAt: null,
      reactivatedAt: new Date(),
      tokenVersion: { increment: 1 }, // ✅ garante sessão nova pós-reativar
    },
  });

  return res.json({ ok: true, usuario: pickUserAdminFields(updated) });
}