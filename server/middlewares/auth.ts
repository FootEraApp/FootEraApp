// server/middlewares/auth.ts
import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { TipoUsuario } from "@prisma/client";
import { resolveUserContext } from "../services/planResolver.js";
import type { PlanoName, UserPayload } from "../services/planResolver.js";

const SECRET = process.env.JWT_SECRET || "footera_secret";

// Alias opcional
export type AuthUser = UserPayload;

/**
 * NÃO mexemos mais em Request["user"].
 * Guardamos tudo em `authUser` para evitar conflito com Express.User.
 */
export type AuthenticatedRequest = Request & {
  userId?: string;
  authUser?: UserPayload;
};

function toTipoUsuario(s: string): TipoUsuario {
  switch (s.toLowerCase()) {
    case "admin":
      return TipoUsuario.Admin;
    case "professor":
      return TipoUsuario.Professor;
    case "clube":
      return TipoUsuario.Clube;
    case "escolinha":
      return TipoUsuario.Escolinha;
    case "olheiro":
      return TipoUsuario.Olheiro;
    default:
      return TipoUsuario.Atleta;
  }
}

export const authenticateToken: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, SECRET) as any;
    const userId = payload.id || payload.sub;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const reqAuthed = req as AuthenticatedRequest;
    reqAuthed.userId = userId;

    // contexto único (usuário + plano)
    const ctx = await resolveUserContext(userId);

    const user: UserPayload = {
      id: userId,
      tipo: ctx.tipo,
      tipoUsuarioId: ctx.tipoUsuarioId ?? null,
      plano: (ctx.plano as PlanoName) ?? "FREE",
      isAdmin: !!ctx.isAdmin,
    };

    // >>> NÃO usamos mais req.user, apenas req.authUser
    reqAuthed.authUser = user;

    return next();
  } catch (err: any) {
    console.error("JWT verify fail:", err.name, err.message);
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};
