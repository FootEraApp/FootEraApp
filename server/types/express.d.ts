import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      tipoUsuarioId?: string;
      tipoUsuario?: string;
    }
  }
}

export {};