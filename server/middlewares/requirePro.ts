// server/src/middlewares/requirePro.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";

export function requirePro(feature: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const u = (req.user as any) || {};
    const isOrgRole = u?.tipo === "Professor" || u?.tipo === "Clube" || u?.tipo === "Escolinha";

    if (u?.plano === "PRO" || isOrgRole) return next();
    return res.status(402).json({ message: `Recurso Pro: ${feature}` });
  };
}
