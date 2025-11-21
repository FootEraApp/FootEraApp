import "express";
import type { TipoUsuario } from "@prisma/client";

declare global {
  namespace Express {
    type PlanoName = "FREE" | "PRO" | "ORG";

    interface UserPayload {
      id: string;
      tipo: TipoUsuario | "Admin";
      tipoUsuarioId?: string | null;
      plano?: PlanoName | null;
      isAdmin?: boolean;
    }

    interface Request {
      userId?: string;
      user?: UserPayload;
    }
  }
}

export {};
