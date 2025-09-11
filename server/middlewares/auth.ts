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

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "defaultsecret"
    ) as { id?: string; userId?: string; tipo?: string };

    const uid = decoded.userId || decoded.id;
    if (!uid) return res.status(401).json({ message: "Token inválido" });

    const usuario = await prisma.usuario.findUnique({
      where: { id: uid },
      include: {
        atleta: true,
        professor: true,
        clube: true,
        escolinha: true,
        olheiro: true,
      },
    });

    if (!usuario) return res.status(401).json({ message: "Usuário inválido" });

    req.userId = usuario.id;
    req.tipo = usuario.tipo;
    req.isAdmin = usuario.tipo === TipoUsuario.Admin;

    let tipoUsuarioStr: AuthenticatedRequest["tipoUsuario"];
    let tipoUsuarioId: string | undefined;

    switch (usuario.tipo) {
      case TipoUsuario.Atleta:
        tipoUsuarioStr = "atleta";
        tipoUsuarioId = usuario.atleta?.id;
        break;
      case TipoUsuario.Professor:
        tipoUsuarioStr = "professor";
        tipoUsuarioId = usuario.professor?.id;
        break;
      case TipoUsuario.Clube:
        tipoUsuarioStr = "clube";
        tipoUsuarioId = usuario.clube?.id;
        break;
      case TipoUsuario.Escolinha:
        tipoUsuarioStr = "escolinha";
        tipoUsuarioId = usuario.escolinha?.id;
        break;
      case TipoUsuario.Olheiro:
        tipoUsuarioStr = "olheiro";
        tipoUsuarioId = usuario.olheiro?.id;
        break;
      case TipoUsuario.Admin:
        tipoUsuarioStr = "admin";
        break;
      default:
        tipoUsuarioStr = undefined;
        break;
    }

    if (!tipoUsuarioId) {
      if (usuario.atleta)       { tipoUsuarioStr = "atleta";    tipoUsuarioId = usuario.atleta.id; }
      else if (usuario.professor){ tipoUsuarioStr = "professor"; tipoUsuarioId = usuario.professor.id; }
      else if (usuario.clube)    { tipoUsuarioStr = "clube";     tipoUsuarioId = usuario.clube.id; }
      else if (usuario.escolinha){ tipoUsuarioStr = "escolinha"; tipoUsuarioId = usuario.escolinha.id; }
      else if (usuario.olheiro)  { tipoUsuarioStr = "olheiro";   tipoUsuarioId = usuario.olheiro.id; }
    }

    req.tipoUsuario = tipoUsuarioStr;
    if (tipoUsuarioId) req.tipoUsuarioId = tipoUsuarioId;

    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
};
