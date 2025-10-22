import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { TipoUsuario } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tipo?: TipoUsuario | string;
  isAdmin?: boolean;
  user?: any;
}

const SECRET = process.env.JWT_SECRET || "footera_secret";

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Token ausente" });

  try {
    const payload = jwt.verify(token, SECRET) as any;

    const id =
      payload?.id ??
      payload?.sub ??
      payload?.userId ??
      payload?.usuarioId ??
      payload?.escolinhaId ??
      payload?.organizationId;

    if (!id) return res.status(401).json({ message: "Token inválido (sem id)" });

    const tipo = String(payload?.tipo ?? payload?.role ?? payload?.tipoUsuario ?? "").trim();
    const isAdmin = tipo.toLowerCase() === "admin" || payload?.isAdmin === true;

    req.userId = String(id);
    req.tipo = tipo;
    req.isAdmin = isAdmin;
    req.user = payload;

    (res.locals as any).user = { id: req.userId, tipo: req.tipo, isAdmin: req.isAdmin, ...payload };

    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
}