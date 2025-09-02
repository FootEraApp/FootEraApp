import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.isAdmin || String(req.tipo).toLowerCase() === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Somente administradores." });
}