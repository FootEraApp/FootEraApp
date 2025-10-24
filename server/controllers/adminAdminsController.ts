import type { Request, Response } from "express";
import { PrismaClient, TipoUsuario, Nivel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function getMe(req: Request, res: Response) {
  const me = (req as any).me ?? null;
  if (!me) return res.status(401).json({ error: "Não autenticado" });

  const adminNivel = me.administrador?.nivel ?? null;
  const adminCargo = me.administrador?.cargo ?? null;

  const isByCargo = ["owner", "superadmin"].includes(
    String(adminCargo ?? "").toLowerCase()
  );
  const isByEnv =
    !!process.env.SUPERADMIN_EMAIL &&
    me.email?.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase();

  const canManageAdmins = me.tipo === TipoUsuario.Admin && (isByCargo || isByEnv);

  return res.json({
    id: me.id,
    email: me.email,
    tipo: me.tipo,
    adminNivel, 
    adminCargo,
    canManageAdmins,
  });
}

export async function createAdmin(req: Request, res: Response) {
  const { email, senha, nome, nivel, cargo } = req.body ?? {};
  if (!email || !senha) {
    return res.status(400).json({ error: "Informe email e senha." });
  }

  const exists = await prisma.usuario.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Já existe usuário com este email." });

  const hash = await bcrypt.hash(String(senha), 10);

  const base = (String(email).split("@")[0] || "admin")
    .replace(/[^a-z0-9._-]/gi, "")
    .toLowerCase();
  const nomeDeUsuario = `${base}-${Date.now().toString(36)}`;
  const nomeFinal = (nome && String(nome).trim()) || base;

  const nivelMap: Record<string, Nivel> = {
    Base: Nivel.Base,
    Avancado: Nivel.Avancado,
    Performance: Nivel.Performance,
  };
  const nivelFinal: Nivel = nivelMap[String(nivel)] ?? Nivel.Base;

  const created = await prisma.usuario.create({
    data: {
      email,
      senhaHash: hash,
      nome: nomeFinal,
      nomeDeUsuario,
      tipo: TipoUsuario.Admin,
      verified: true,
      administrador: {
        create: {
          cargo: cargo ?? "admin",
          nivel: nivelFinal,
        },
      },
    },
    include: { administrador: true },
  });

  return res.status(201).json({
    id: created.id,
    email: created.email,
    tipo: created.tipo,
    administrador: created.administrador,
  });
}

export async function deleteAdmin(req: Request, res: Response) {
  const { id } = req.params;
  const me = (req as any).me;
  if (!id) return res.status(400).json({ error: "ID é obrigatório." });

  if (String(me.id) === String(id)) {
    return res.status(400).json({ error: "Você não pode deletar sua própria conta." });
  }

  const target = await prisma.usuario.findUnique({
    where: { id },
    include: { administrador: true },
  });
  if (!target || target.tipo !== TipoUsuario.Admin) {
    return res.status(404).json({ error: "Admin não encontrado." });
  }

  const targetIsSuper =
    ["owner", "superadmin"].includes(String(target.administrador?.cargo ?? "").toLowerCase()) ||
    (!!process.env.SUPERADMIN_EMAIL &&
      target.email?.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase());
  if (targetIsSuper) {
    return res.status(403).json({ error: "Não é permitido deletar o super admin." });
  }

  const countAdmins = await prisma.usuario.count({ where: { tipo: TipoUsuario.Admin } });
  if (countAdmins <= 1) {
    return res.status(400).json({ error: "Não é possível remover o último administrador." });
  }

  await prisma.administrador.deleteMany({ where: { usuarioId: id } });
  await prisma.usuario.delete({ where: { id } });

  return res.json({ ok: true });
}