// server/middlewares/auth
import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient, TipoUsuario } from "@prisma/client";
import { resolveUserContext } from "../services/planResolver.js";
import type { PlanoName, UserPayload } from "../services/planResolver.js"

const prisma = new PrismaClient();

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET não configurado no ambiente.");
}

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

type DbUser = Prisma.UsuarioGetPayload<{
  select: {
    id: true;
    tokenVersion: true;
    tipo: true;
    deletedAt: true;
    status: true;
    blockedAt: true;
    blockedReason: true;
    parceiro: true;
  };
}>;

export const authenticateToken: RequestHandler = async (req, res, next) => {
  const publicRoutes = new Set([
    "/api/status/maintenance",
    "/api/status",
    "/api/auth/login",
    "/api/auth/google",
    "/api/auth/google/complete-registration",
  ]);

  const url = (req.originalUrl || "").split("?")[0];
  if (publicRoutes.has(url)) {
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
      err.message,
      "| tokenPrefix =",
      token ? token.slice(0, 20) : "sem-token",
      "| secretLoaded =",
      !!SECRET
    );
    console.error("[AUTH JWT ERROR]", {
      name: err.name,
      message: err.message,
      secretPrefix: SECRET.slice(0, 5),
      tokenPrefix: token.slice(0, 20),
    });
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

  let dbUser: DbUser | null = null;
  try {
    dbUser = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tokenVersion: true,
        tipo: true,
        deletedAt: true,
        status: true,
        blockedAt: true,
        blockedReason: true,
        parceiro: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Usuário inválido." });
    }

    if (dbUser.deletedAt) {
      return res.status(401).json({
        message: "Conta está na lixeira (em processo de exclusão).",
        code: "ACCOUNT_DELETED",
      });
    }

    const status = String(dbUser.status ?? "").toUpperCase();
      if (status === "BLOQUEADO" || dbUser.blockedAt) {
        return res.status(403).json({
          message: "Conta bloqueada.",
          code: "ACCOUNT_BLOCKED",
          blockedReason: (dbUser as any).blockedReason ?? null,
        });
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

  try {
      const ctx = await resolveUserContext(userId);

      let tipoUsuarioIdFinal = ctx.tipoUsuarioId ?? null;

      if (!tipoUsuarioIdFinal) {
        const tipoCtx = String(ctx.tipo || "").toLowerCase();

        if (tipoCtx === "olheiro") {
          const olheiro = await prisma.olheiro.findUnique({
            where: { usuarioId: userId },
            select: { id: true },
          });
          tipoUsuarioIdFinal = olheiro?.id ?? null;
        }

        if (tipoCtx === "clube") {
          const clube = await prisma.clube.findUnique({
            where: { usuarioId: userId },
            select: { id: true },
          });
          tipoUsuarioIdFinal = clube?.id ?? null;
        }

        if (tipoCtx === "escolinha") {
          const escolinha = await prisma.escolinha.findUnique({
            where: { usuarioId: userId },
            select: { id: true },
          });
          tipoUsuarioIdFinal = escolinha?.id ?? null;
        }

        if (tipoCtx === "professor") {
          const professor = await prisma.professor.findUnique({
            where: { usuarioId: userId },
            select: { id: true },
          });
          tipoUsuarioIdFinal = professor?.id ?? null;
        }

        if (tipoCtx === "atleta") {
          const atleta = await prisma.atleta.findUnique({
            where: { usuarioId: userId },
            select: { id: true },
          });
          tipoUsuarioIdFinal = atleta?.id ?? null;
        }
      }

      const user: UserPayload = {
        id: userId,
        tipo: ctx.tipo,
        tipoUsuarioId: tipoUsuarioIdFinal,
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

  try {
    const THROTTLE_MS = 60_000; 
    const key = userId;

    (globalThis as any).__lastSeenMap ??= new Map<string, number>();
    const m: Map<string, number> = (globalThis as any).__lastSeenMap;

    const now = Date.now();
    const prev = m.get(key) ?? 0;

    if (now - prev > THROTTLE_MS) {
      m.set(key, now);
      prisma.usuario
        .update({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    }
  } catch {
  }

  return next();
};

export const auth = authenticateToken;
export const requireAuth = authenticateToken;
export const authMiddleware = authenticateToken;