import type { Request, Response, NextFunction } from "express";
import { PrismaClient, TipoUsuario} from "@prisma/client";

const prisma = new PrismaClient();

type AuthedReq = Request & { user?: any; usuarioId?: string; userId?: string };

async function loadCurrentUser(req: AuthedReq) {
  const tokenUserId =
    req.user?.id ?? req.user?.usuarioId ?? (req as any).usuarioId ?? (req as any).userId;
  if (!tokenUserId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: String(tokenUserId) },
    include: { administrador: true },
  });
  return usuario;
}

export async function requireAdmin(req: AuthedReq, res: Response, next: NextFunction) {
  const me = await loadCurrentUser(req);
  if (!me || me.tipo !== TipoUsuario.Admin) {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  (req as any).me = me;
  return next();
}

export async function requireSuperAdmin(req: AuthedReq, res: Response, next: NextFunction) {
  await requireAdmin(req, res, async () => {
    const me = (req as any).me as Awaited<ReturnType<typeof loadCurrentUser>>;
    const isByCargo = ["owner", "superadmin"].includes(
      (me?.administrador?.cargo ?? "").toLowerCase()
    );
    const isByEnv =
      !!process.env.SUPERADMIN_EMAIL &&
      me?.email?.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase();

    if (!(isByCargo || isByEnv )) {
      return res.status(403).json({ error: "Apenas o super admin pode executar esta ação." });
    }
    return next();
  });
}