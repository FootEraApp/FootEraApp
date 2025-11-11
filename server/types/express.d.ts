import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    user?: {
      id: string;
      tipo: import("@prisma/client").TipoUsuario | "Admin" | "Atleta" | "Professor" | "Clube" | "Escolinha";
      tipoUsuarioId?: string | null;
      plano?: "FREE" | "PRO" | null;
      isAdmin?: boolean;
    };
  }
}
