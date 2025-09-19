import "express";
import "express-serve-static-core";
import { TipoUsuario } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      tipoUsuarioId?: string;
      tipoUsuario?: string;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id?: string;
      usuarioId?: string;
      tipo?: TipoUsuario | string;
      tipoUsuarioId?: string | null;
    };
  }
}

export {};