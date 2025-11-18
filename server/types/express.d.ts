// server/types/express.d.ts
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

    // isto MERGEIA com o Request do express-serve-static-core
    interface Request {
      userId?: string;
      user?: UserPayload;
    }
  }
}

export {};
