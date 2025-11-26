import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { TipoUsuario } from "@prisma/client";
import { resolveUserContext } from "../services/planResolver.js";
import type { PlanoName, UserPayload } from "../services/planResolver.js";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.JWT_SECRET || "footera_secret";

export type AuthUser = UserPayload;

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

  console.log("[AUTH] header em", req.method, req.originalUrl, "=", auth || "<vazio>");

  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

  if (!token) {
    console.warn("[AUTH] sem token em", req.originalUrl);
    return res.status(401).json({ message: "Missing token" });
  }

  let payload: any;
  try {
    payload = jwt.verify(token, SECRET);
  } catch (err: any) {
    console.error(
      "[AUTH] JWT verify fail em",
      req.originalUrl,
      "->",
      err.name,
      err.message
    );
    return res.status(401).json({ message: "Invalid/expired token" });
  }

  const userId = payload.id || payload.sub;
  if (!userId) {
    console.error("[AUTH] payload sem id/sub em", req.originalUrl, "payload =", payload);
    return res.status(401).json({ message: "Invalid token payload" });
  }

  const reqAuthed = req as AuthenticatedRequest;
  reqAuthed.userId = userId;

  try {
    const ctx = await resolveUserContext(userId);

    const user: UserPayload = {
      id: userId,
      tipo: ctx.tipo,
      tipoUsuarioId: ctx.tipoUsuarioId ?? null,
      plano: (ctx.plano as PlanoName) ?? "FREE",
      isAdmin: !!ctx.isAdmin,
    };

    reqAuthed.authUser = user;
  } catch (e: any) {
    console.error("[AUTH] resolveUserContext failed em", req.originalUrl, "->", e);

    const tipoRaw = String(payload.tipo || "").toLowerCase();
    const tipo =
      tipoRaw === "admin" ||
      tipoRaw === "professor" ||
      tipoRaw === "clube" ||
      tipoRaw === "escolinha" ||
      tipoRaw === "olheiro"
        ? (toTipoUsuario(tipoRaw) as any)
        : ("Atleta" as any);

    reqAuthed.authUser = {
      id: userId,
      tipo,
      tipoUsuarioId: null,
      plano: "FREE",
      isAdmin: tipoRaw === "admin",
    };
  }

  return next();
};

export const auth = authenticateToken;
export const requireAuth = authenticateToken;
export const authMiddleware = authenticateToken;