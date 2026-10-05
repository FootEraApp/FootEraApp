// server/middlewares/auth.ts
import { RequestHandler, Request } from "express";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
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

type DbUser = Prisma.UsuarioGetPayload<{
  select: {
    id: true;
    tokenVersion: true;
    tipo: true;
    verified: true;
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
        verified: true,
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

    const podeUsarSemVerificacao =
      url ===
      "/api/legal/consentimentos";

    const purpose =
      String(
        payload?.purpose ?? ""
      );

    if (
      purpose ===
        "registration-consent" &&
      !podeUsarSemVerificacao
    ) {
      return res
        .status(403)
        .json({
          message:
            "Confirme seu e-mail para continuar.",
          code:
            "EMAIL_NOT_VERIFIED",
          needVerification:
            true,
        });
    }

    if (
      !dbUser.verified &&
      !podeUsarSemVerificacao
    ) {
      return res
        .status(403)
        .json({
          message:
            "Confirme seu e-mail para ativar sua conta.",
          code:
            "EMAIL_NOT_VERIFIED",
          needVerification:
            true,
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
    const ctx =
      await resolveUserContext(
        userId
      );

    const user: UserPayload = {
      id:
        userId,

      tipo:
        ctx.tipo,

      tipoUsuarioId:
        ctx.tipoUsuarioId ??
        null,

      activeContext:
        ctx.activeContext ??
        null,

      plano:
        ((ctx.plano as PlanoName) ??
          "FREE") as PlanoName,

      isAdmin:
        !!ctx.isAdmin,

      parceiro,
    };

    reqAuthed.authUser =
      user;

    (reqAuthed as any).user =
      user;
  } catch (e: any) {
    console.error(
      "[AUTH] resolveUserContext failed em",
      req.originalUrl,
      "->",
      e
    );

    return res.status(500).json({
      message:
        "Não foi possível resolver o contexto ativo do usuário.",
      code:
        "ACTIVE_CONTEXT_RESOLUTION_FAILED",
    });
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

export const optionalAuthenticateToken: RequestHandler = (
  req,
  res,
  next
) => {
  const auth =
    req.headers.authorization || "";

  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : auth.trim();

  if (!token) {
    return next();
  }

  return authenticateToken(
    req,
    res,
    next
  );
};