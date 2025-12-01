// server/middlewares/guards
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { canDetailed } from "../services/entitlements.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function requireCapability(
  capability:
    | "agendamento:pessoal"
    | "agendamento:lote"
    | "templates:criar"
    | "desafios:por_mes"
    | "treinos:por_semana"
    | "perfil:olheiro:consultas_dia"
) {
  const map: Record<string, any> = {
    "agendamento:pessoal": "agendamento.pessoal",
    "agendamento:lote":    "agendamento.lote",
    "templates:criar":     "templates:criar",
    "desafios:por_mes":    "desafios.mes",
    "treinos:por_semana":  "treinos.semana",
    "perfil:olheiro:consultas_dia": "perfisPorDia",
  };

  const key = map[capability] ?? capability;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = (req as any).user || {};
    const result = canDetailed(user, key);
    if (result.ok) return next();
    return res.status(result.http).json({ error: result.reason, capability });
  };
}

export function requireOrgSeat(getOrgId: (req: AuthenticatedRequest) => string | null | undefined) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const orgId = getOrgId(req);
    const user  = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Não autenticado" });
    if (!orgId)   return res.status(400).json({ error: "orgId ausente" });

    const [esc, clu, prof] = await Promise.all([
      prisma.escolinha.findFirst({ where: { id: orgId }, select: { usuarioId: true } }),
      prisma.clube.findFirst({ where: { id: orgId }, select: { usuarioId: true } }),
      prisma.professor.findFirst({ where: { usuarioId: user.id }, select: { id: true, escolinhaId: true, clubeId: true } }),
    ]);

    if (esc?.usuarioId === user.id || clu?.usuarioId === user.id) return next();
    if (prof && (prof.escolinhaId === orgId || prof.clubeId === orgId)) return next();

    return res.status(403).json({ error: "Sem assento nesta organização" });
  };
}

export function requireAdmin() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if ((req as any).user?.isAdmin) return next();
    return res.status(403).json({ error: "Apenas administradores" });
  };
}
