import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const t = String(req.tipo ?? (res.locals.user?.tipo ?? "")).toLowerCase();
  const ok = req.isAdmin === true || t === "admin";
  if (!ok) return res.status(403).json({ message: "Somente administradores." });
  next();
}