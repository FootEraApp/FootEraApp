import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import { resolveUserContext } from "../services/planResolver.js";
import type { Request, Response, NextFunction } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "footera_secret";

export type PlanoName = "FREE" | "PRO" | "ORG";

export interface AuthUser {
  id: string;
  // Prisma exporta como union de strings; comparar com "Professor" etc. funciona
  tipo: TipoUsuario;
  tipoUsuarioId?: string | null;
  plano?: PlanoName | null;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: string;
  user?: AuthUser; // mantém shape único aqui
}

function toTipoUsuario(s: string): TipoUsuario {
  switch (s.toLowerCase()) {
    case "admin": return TipoUsuario.Admin;
    case "professor": return TipoUsuario.Professor;
    case "clube": return TipoUsuario.Clube;
    case "escolinha": return TipoUsuario.Escolinha;
    case "olheiro": return TipoUsuario.Olheiro;
    default: return TipoUsuario.Atleta;
  }
}

export const authenticateToken: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, SECRET) as any;
    const userId = payload.id || payload.sub;
    if (!userId) return res.status(401).json({ message: "Invalid token payload" });

    (req as AuthenticatedRequest).userId = userId;

    // fonte única de verdade de usuário/plano
    const ctx = await resolveUserContext(userId);

    const user: AuthUser = {
      id: userId,
      tipo: toTipoUsuario(ctx.tipo),
      tipoUsuarioId: ctx.tipoUsuarioId ?? null,
      plano: (ctx.plano as PlanoName) ?? null,
      isAdmin: !!ctx.isAdmin,
    };

    (req as AuthenticatedRequest).user = user;
    return next();
  } catch (err: any) {
    console.error("JWT verify fail:", err.name, err.message);
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};
