import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tipoUsuarioId?: string;
  tipoUsuario?: string;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret") as {
      id: string; tipo: string;
    };

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      include: { atleta: true, professor: true, clube: true, escolinha: true },
    });
    if (!usuario) return res.status(401).json({ message: "Usuário inválido" });

    req.userId = usuario.id;
    if (usuario.atleta) { req.tipoUsuario = "atleta"; req.tipoUsuarioId = usuario.atleta.id; }
    else if (usuario.professor) { req.tipoUsuario = "professor"; req.tipoUsuarioId = usuario.professor.id; }
    else if (usuario.clube) { req.tipoUsuario = "clube"; req.tipoUsuarioId = usuario.clube.id; }
    else if (usuario.escolinha) { req.tipoUsuario = "escolinha"; req.tipoUsuarioId = usuario.escolinha.id; }

    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
};