// server/src/middlewares/auth.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "footera_secret";

export type PlanoName = "FREE" | "PRO";
export interface AuthUser {
  id: string;
  tipo: TipoUsuario | "Atleta" | "Professor" | "Clube" | "Escolinha" | "Admin";
  tipoUsuarioId?: string | null;
  plano?: PlanoName | null;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: AuthUser;
}

export const authenticateToken: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, SECRET) as any;
    const userId = payload.id || payload.sub;
    if (!userId) return res.status(401).json({ message: "Invalid token payload" });

    req.userId = userId;

    let tipo: AuthUser["tipo"] | undefined = payload.tipo;
    let plano: AuthUser["plano"] | undefined = payload.plano;
    let tipoUsuarioId: string | undefined = payload.tipoUsuarioId;
    let isAdmin: boolean | undefined = !!payload.isAdmin;

    if (!tipo || !tipoUsuarioId || plano === undefined || isAdmin === undefined) {
      const u = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tipo: true,
          administrador: { select: { id: true } },
          assinatura: { select: { ativo: true, plano: true } },
          atleta: { select: { id: true } },
          professor: { select: { id: true } },
          clube: { select: { id: true } },
          escolinha: { select: { id: true } },
        },
      });

      if (!u) return res.status(401).json({ message: "Usuário inválido" });

      tipo = (u.tipo as any) ?? "Atleta";
      isAdmin = !!u.administrador;
      // Regra simples: se tem assinatura ativa, considere PRO; caso contrário FREE
      plano = u.assinatura?.ativo ? "PRO" : "FREE";
      tipoUsuarioId =
        u.atleta?.id ?? u.professor?.id ?? u.clube?.id ?? u.escolinha?.id ?? undefined;
    }

    req.user = { id: userId, tipo: (tipo as any) || "Atleta", tipoUsuarioId, plano, isAdmin };
    return next();
  } catch (err: any) {
    console.error("JWT verify fail:", err.name, err.message);
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};
