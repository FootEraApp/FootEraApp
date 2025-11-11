// middlewares/requireAdmin.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // vem do authenticateToken
  const tipo = String(req.user?.tipo ?? res.locals?.user?.tipo ?? "").toLowerCase();
  const isAdmin = (req.user?.isAdmin === true) || (res.locals?.user?.isAdmin === true);

  if (!(isAdmin || tipo === "admin")) {
    return res.status(403).json({ message: "Somente administradores." });
  }
  next();
}
