// server/middlewares/auth
import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { TipoUsuario } from "@prisma/client";
import { resolveUserContext } from "../services/planResolver.js";
import type { PlanoName, UserPayload } from "../services/planResolver.js";
import dotenv from "dotenv";
import { prisma } from "../prisma.js";

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
  const publicPrefixes = ["/api/status/maintenance", "/api/status", "/api/auth"];

  const url = req.originalUrl || "";
  if (publicPrefixes.some((p) => url.startsWith(p))) {
    return next();
  }

  const auth = req.headers.authorization || "";
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

  const userIdRaw = payload?.id || payload?.sub || payload?.userId;
  const userId = userIdRaw ? String(userIdRaw) : "";

  if (!userId) {
    console.error(
      "[AUTH] payload sem id/sub/userId em",
      req.originalUrl,
      "payload =",
      payload
    );
    return res.status(401).json({ message: "Invalid token payload" });
  }

  // ✅ tokenVersion: invalida tokens antigos quando "encerrar sessões" é acionado
  let dbUser: { id: string; tokenVersion: number; tipo: TipoUsuario; parceiro: boolean } | null = null;
  try {
    dbUser = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, tokenVersion: true, tipo: true, parceiro: true },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Usuário inválido." });
    }

    const tokenV = Number(payload?.tokenVersion ?? 0);
    const dbV = Number(dbUser.tokenVersion ?? 0);

    if (tokenV !== dbV) {
      return res.status(401).json({
        message: "Sessão expirada. Faça login novamente.",
        code: "TOKEN_VERSION_MISMATCH",
      });
    }
  } catch (e) {
    console.error("[AUTH] tokenVersion check failed:", e);
    return res.status(401).json({ message: "Sessão inválida." });
  }

const parceiro = Boolean(dbUser?.parceiro);


  const reqAuthed = req as AuthenticatedRequest;
  reqAuthed.userId = userId;

  // mantém seu resolveUserContext
  try {
    const ctx = await resolveUserContext(userId);

    const user: UserPayload = {
      id: userId,
      tipo: ctx.tipo,
      tipoUsuarioId: ctx.tipoUsuarioId ?? null,
      plano: ((ctx.plano as PlanoName) ?? "FREE") as PlanoName,
      isAdmin: !!ctx.isAdmin,
      parceiro,
    };


    reqAuthed.authUser = user;
    (reqAuthed as any).user = user;
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

    const user: UserPayload = {
      id: userId,
      tipo,
      tipoUsuarioId: null,
      plano: "FREE" as PlanoName,
      isAdmin: tipoRaw === "admin",
      parceiro,
    };


    reqAuthed.authUser = user;
    (reqAuthed as any).user = user;
  }

  return next();
};

export const auth = authenticateToken;
export const requireAuth = authenticateToken;
export const authMiddleware = authenticateToken;