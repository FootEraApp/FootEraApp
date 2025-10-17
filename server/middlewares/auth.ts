import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tipoUsuarioId?: string;
  tipoUsuario?: string; 
  tipo?: TipoUsuario | string;
  isAdmin?: boolean;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token ausente" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const id =
      payload?.sub ??
      payload?.id ??
      payload?.userId ??
      payload?.usuarioId ??
      payload?.escolinhaId ??
      payload?.organizationId;

    if (!id) return res.status(401).json({ message: "Token inválido (sem id)" });

    (req as any).userId = String(id);
    (req as any).user = { id: String(id), ...payload };

    next();
  } catch (e) {
    return res.status(401).json({ message: "Token inválido" });
  }
}