import type { Request, Response, NextFunction } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

type AuthedReq = Request & { user?: any; usuarioId?: string; userId?: string };

async function loadCurrentUser(req: AuthedReq) {
  const tokenUserId =
    req.user?.id ??
    req.user?.usuarioId ??
    (req as any).usuarioId ??
    (req as any).userId;

  if (!tokenUserId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: String(tokenUserId) },
    include: { administrador: true },
  });

  return usuario;
}

export async function requireAdmin(
  req: AuthedReq,
  res: Response,
  next: NextFunction
) {
  const me = await loadCurrentUser(req);
  if (!me || me.tipo !== TipoUsuario.Admin) {
    return res
      .status(403)
      .json({ error: "Acesso restrito a administradores." });
  }

  (req as any).me = me;
  (req as any).isAdmin = true;
  return next();
}

export async function requireSuperAdmin(
  req: AuthedReq,
  res: Response,
  next: NextFunction
) {
  await requireAdmin(req, res, async () => {
    const me = (req as any).me as Awaited<ReturnType<typeof loadCurrentUser>>;
    if (!me) {
      return res
        .status(403)
        .json({ error: "Acesso restrito a administradores." });
    }

    const cargoRaw = (me.administrador?.cargo ?? "").toLowerCase().trim();
    const cargo = cargoRaw.replace(/\s+/g, " ");

    const nivelRaw = (me.administrador as any)?.nivel ?? "";
    const nivel = String(nivelRaw).toLowerCase().trim();

    const isByCargo =
      cargo === "super admin" || cargo === "superadmin" || cargo === "owner";

    const isByNivel = nivel === "performance";

    const isByEnv =
      !!process.env.SUPERADMIN_EMAIL &&
      me.email?.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase();

    if (!(isByCargo || isByNivel || isByEnv)) {
      return res
        .status(403)
        .json({ error: "Apenas o super admin pode executar esta ação." });
    }

    (req as any).isSuperAdmin = true;
    return next();
  });
}