import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { prisma } from "../prisma.js";

import {
  canPermission,
} from "../services/permissions.js";

type AuthedReq = Request & {
  user?: any;
  authUser?: any;
  usuarioId?: string;
  userId?: string;
};

function getUserId(
  req: AuthedReq
): string {
  return String(
    req.userId ??
      req.usuarioId ??
      req.user?.id ??
      req.user?.usuarioId ??
      req.authUser?.id ??
      ""
  ).trim();
}

async function loadCurrentUser(
  req: AuthedReq
) {
  const userId =
    getUserId(req);

  if (!userId) {
    return null;
  }

  return prisma.usuario.findUnique({
    where: {
      id: userId,
    },

    include: {
      administrador: true,
    },
  });
}

export async function requireAdmin(
  req: AuthedReq,
  res: Response,
  next: NextFunction
) {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error:
          "Não autenticado.",
      });
    }

    const permitido =
      await canPermission(
        userId,
        "VER_ADMIN"
      );

    if (!permitido) {
      return res
        .status(403)
        .json({
          error:
            "Acesso restrito a administradores.",
        });
    }

    const me =
      await loadCurrentUser(
        req
      );

    if (!me) {
      return res
        .status(401)
        .json({
          error:
            "Usuário não encontrado.",
        });
    }

    (req as any).me =
      me;

    (req as any).isAdmin =
      true;

    return next();
  } catch (error) {
    console.error(
      "[ADMIN_GUARD] requireAdmin:",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao validar permissão administrativa.",
    });
  }
}

export async function requireSuperAdmin(
  req: AuthedReq,
  res: Response,
  next: NextFunction
) {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error:
          "Não autenticado.",
      });
    }

    const permitido =
      await canPermission(
        userId,
        "VER_ADMIN"
      );

    if (!permitido) {
      return res
        .status(403)
        .json({
          error:
            "Acesso restrito a administradores.",
        });
    }

    const me =
      await loadCurrentUser(
        req
      );

    if (
      !me ||
      !me.administrador
    ) {
      return res
        .status(403)
        .json({
          error:
            "Acesso restrito a administradores.",
        });
    }

    const cargoRaw =
      String(
        me.administrador
          ?.cargo ??
          ""
      )
        .toLowerCase()
        .trim();

    const cargo =
      cargoRaw.replace(
        /\s+/g,
        " "
      );

    const nivel =
      String(
        (me.administrador as any)
          ?.nivel ??
          ""
      )
        .toLowerCase()
        .trim();

    const isByCargo =
      cargo ===
        "super admin" ||
      cargo ===
        "superadmin" ||
      cargo ===
        "owner";

    const isByNivel =
      nivel ===
      "performance";

    const isByEnv =
      Boolean(
        process.env
          .SUPERADMIN_EMAIL
      ) &&
      me.email
        ?.toLowerCase() ===
        process.env
          .SUPERADMIN_EMAIL!
          .toLowerCase();

    if (
      !(
        isByCargo ||
        isByNivel ||
        isByEnv
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "Apenas o super admin pode executar esta ação.",
        });
    }

    (req as any).me =
      me;

    (req as any).isAdmin =
      true;

    (req as any)
      .isSuperAdmin =
      true;

    return next();
  } catch (error) {
    console.error(
      "[ADMIN_GUARD] requireSuperAdmin:",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao validar permissão de super administrador.",
    });
  }
}