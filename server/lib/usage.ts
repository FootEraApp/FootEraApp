import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { sendLimitInfo } from "./limitInfo.js";
import { UPGRADE_HINT_BY_CAP } from "./upgradeHints.js";
import {
  recordCapabilityDecision,
  logCapabilityDenied,
} from "../services/observability.js";

const prisma = new PrismaClient();

export type UsageKey =
  | "treinos_semana"
  | "desafios_mes"
  | "treinos_salvos_total"
  | "planos_ativos_total"
  | "templates_total"
  | "perfis_vistos_dia"
  | "listas_salvas_total"
  | "atletas_vinculados_total"
  | "assentos_coach_total"
  | "turmas_total"
  | "agendamentos_mes"
  | "treinos_programados_mes"
  | "agendamento_rotina_mensal";

type Window = "day" | "week" | "month" | "total";

const WINDOW_BY_KEY: Record<UsageKey, Window> = {
  treinos_semana: "week",
  desafios_mes: "month",
  treinos_salvos_total: "total",
  planos_ativos_total: "total",
  templates_total: "total",
  perfis_vistos_dia: "day",
  listas_salvas_total: "total",
  atletas_vinculados_total: "total",
  assentos_coach_total: "total",
  turmas_total: "total",
  agendamentos_mes: "month",
  treinos_programados_mes: "month",
  agendamento_rotina_mensal: "month",
};

const LIMITS = {
  FREE: {
    treinos_semana: 5,
    desafios_mes: 2,
    treinos_salvos_total: 5,
    planos_ativos_total: 5,
    templates_total: 10,
    perfis_vistos_dia: 20,
    listas_salvas_total: 2,
    atletas_vinculados_total: 100,
    assentos_coach_total: 30,
    turmas_total: 30,
    agendamentos_mes: 100,
    treinos_programados_mes: 10,
  },
  PRO: {
    treinos_semana: Infinity,
    desafios_mes: Infinity,
    treinos_salvos_total: Infinity,
    planos_ativos_total: 1000,
    templates_total: 500,
    perfis_vistos_dia: 200,
    listas_salvas_total: Infinity,
    atletas_vinculados_total: 600,
    assentos_coach_total: 30,
    turmas_total: 30,
    agendamentos_mes: 20000,
    treinos_programados_mes: Infinity,
  },
  LEARNING: {
    treinos_semana: Infinity,
    desafios_mes: Infinity,
    treinos_salvos_total: Infinity,
    planos_ativos_total: 1000,
    templates_total: 500,
    perfis_vistos_dia: 200,
    listas_salvas_total: Infinity,
    atletas_vinculados_total: 600,
    assentos_coach_total: 30,
    turmas_total: 30,
    agendamentos_mes: 20000,
    treinos_programados_mes: Infinity,
  },
} as const;

const CAPABILITY_BY_KEY: Record<UsageKey, string> = {
  treinos_semana: "SUBMISSAO_TREINO",
  desafios_mes: "SUBMISSAO_DESAFIO",
  treinos_salvos_total: "TREINO_SALVO",
  planos_ativos_total: "PLANO_ATIVO",
  templates_total: "TEMPLATE_TREINO",
  perfis_vistos_dia: "PERFIL_VIEW",
  listas_salvas_total: "LISTA_OLHEIRO",
  atletas_vinculados_total: "ATLETAS_VINCULADOS",
  assentos_coach_total: "ASSENTOS_COACH",
  turmas_total: "TURMAS",
  agendamentos_mes: "AGENDAMENTOS",
  treinos_programados_mes: "TREINOS_PROGRAMADOS_MES",
  agendamento_rotina_mensal: "AGENDAMENTO_ROTINA_MENSAL",
};

const WINDOW_LABEL: Record<Window, string> = {
  day: "1d",
  week: "7d",
  month: "30d",
  total: "TOTAL",
};



export function planLimitFor(
  userPlan: "FREE" | "PRO" | "LEARNING" | string | null | undefined,
  key: UsageKey
) {
  const raw = String(userPlan ?? "FREE").trim().toUpperCase();

  const plan =
    raw.includes("LEARNING") ? "LEARNING" :
    raw === "PRO" || raw.includes("PRO") ? "PRO" :
    "FREE";

  const limits = LIMITS[plan] ?? LIMITS.FREE;
  const v = (limits as any)?.[key];
  return v === Infinity ? Infinity : Number(v ?? Infinity);
}

const WIN_KIND_MAP: Record<Window, "DAY" | "WEEK" | "MONTH" | "TOTAL"> = {
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
  total: "TOTAL",
};

function boundsFor(win: Window, ref = new Date()) {
  let windowStart: Date, windowEnd: Date, periodRef: string;

  if (win === "day") {
    const s = new Date(ref); s.setHours(0,0,0,0);
    const e = new Date(s); e.setDate(s.getDate() + 1);
    windowStart = s; windowEnd = e; periodRef = s.toISOString().slice(0,10);
  } else if (win === "week") {
    const s = new Date(ref); s.setHours(0,0,0,0);
    let dow = s.getDay() || 7; if (dow !== 1) s.setDate(s.getDate() - (dow - 1));
    const e = new Date(s); e.setDate(s.getDate() + 7);
    const y = s.getUTCFullYear();
    const w = Math.ceil((((s.getTime() - Date.UTC(y,0,1)) / 86400000) + (new Date(Date.UTC(y,0,1)).getUTCDay()||7)-1)/7);
    windowStart = s; windowEnd = e; periodRef = `${y}-W${String(w).padStart(2,"0")}`;
  } else if (win === "month") {
    const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const e = new Date(s); e.setMonth(s.getMonth() + 1);
    windowStart = s; windowEnd = e; periodRef = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,"0")}`;
  } else {
    windowStart = new Date(0);
    windowEnd = new Date("9999-12-31T23:59:59.999Z");
    periodRef = "TOTAL";
  }
  return { windowStart, windowEnd, periodRef, windowKind: WIN_KIND_MAP[win] };
}

export async function requireUsage(
  req: AuthenticatedRequest,
  res: Response,
  key: UsageKey
): Promise<boolean> {
  const plan = (req.user as any)?.plano as string | undefined;
  const limit = planLimitFor(plan, key);
  const win = WINDOW_BY_KEY[key];

  if (!Number.isFinite(limit)) {
    return true;
  }

  const authUserId = (req as any).userId as string | undefined;
  if (!authUserId) {
    res.status(401).json({ code: "UNAUTHENTICATED" });
    return false;
  }

  // ✅ para Professor/Clube/Escolinha, o limite deve ser por organização
  const subjectIdFromBody =
    String((req as any)?.body?.tipoUsuarioId || "").trim() || null;

  const subjectId =
    subjectIdFromBody ||
    String(
      (req.user as any)?.tipoUsuarioId ||
      (req.user as any)?.tipoUsuarioIdRaw ||
      (req.user as any)?.clubeId ||
      (req.user as any)?.escolinhaId ||
      (req.user as any)?.professorId ||
      authUserId
    );
    // ✅ TREINOS_PROGRAMADOS_MES (na prática: limite por quantidade no banco, não por tentativas)
  if (key === "treinos_programados_mes") {
    const tipoRaw = String(
      (req as any)?.body?.tipoUsuario ??
      (req as any)?.body?.tipo ??
      (req.user as any)?.tipo ??
      (req.user as any)?.tipoUsuario ??
      (req.user as any)?.usuarioTipoRaw ??
      ""
    ).trim().toLowerCase();
    // conta treinos do dono (clube/escolinha/professor); fallback: criadorUsuarioId
    const where: any = (() => {
      if (tipoRaw.includes("clube")) return { clubeId: subjectId };
      if (tipoRaw.includes("escolinha") || tipoRaw.includes("escola")) return { escolinhaId: subjectId };
      if (tipoRaw.includes("professor")) return { OR: [{ professorId: subjectId }, { criadorProfessorId: subjectId }] };
      return { OR: [{ clubeId: subjectId }, { escolinhaId: subjectId }] };
    })();

    const used = await prisma.treinoProgramado.count({ where });
    const remaining = Math.max(0, Number(limit) - used);
    const allowed = used < Number(limit); // ✅ se já tem 5, não deixa criar o 6º

    if (!allowed) {
      const capability = CAPABILITY_BY_KEY[key] ?? key;

      recordCapabilityDecision({ capability, allowed: false });
      logCapabilityDenied({
        req,
        capability,
        periodRef: boundsFor("month").periodRef,
        remaining,
        reason: "USAGE_LIMIT",
      });

      // ✅ manda lista para o front escolher 1 pra apagar
      const meus = await prisma.treinoProgramado.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true, nome: true, createdAt: true },
        take: 50,
      });

      res.status(400).json({
        code: "LIMIT_TREINOS_PROGRAMADOS",
        message:
          "Você atingiu o limite de 5 treinos. Escolha um para apagar e liberar espaço.",
        limit: Number(limit),
        meus,
      });
      return false;
    }

    recordCapabilityDecision({ capability: CAPABILITY_BY_KEY[key] ?? key, allowed: true });
    return true;
  }

  const chk = await incAndCheck(subjectId, key, limit, win);
  const capability = CAPABILITY_BY_KEY[key] ?? key;

  if (!chk.allowed) {
    recordCapabilityDecision({ capability, allowed: false });
    logCapabilityDenied({
      req,
      capability,
      periodRef: chk.periodRef,
      remaining: chk.remaining,
      reason: "USAGE_LIMIT",
    });

    denyUsage(res, key, {
      limit: chk.limit,
      used: chk.used,
      remaining: chk.remaining,
      window: win,
      periodRef: chk.periodRef,
    });
    return false;
  }

  recordCapabilityDecision({ capability, allowed: true });
  return true;
}

export async function incAndCheck(
  userId: string,
  key: UsageKey,
  limit: number,
  win: Window
) {
  const { windowStart, windowEnd, periodRef, windowKind } = boundsFor(win, new Date());

  return prisma.$transaction(async (tx) => {
    const existing = await tx.usageCounter.findUnique({
      where: {
        userId_key_windowKind_windowStart: { userId, key, windowKind, windowStart },
      },
      select: { count: true },
    });

    const usedNow = existing?.count ?? 0;

    // ✅ se já bateu o limite, não incrementa
    if (Number.isFinite(limit) && usedNow >= limit) {
      const used = usedNow;
      const remaining = 0;
      return { allowed: false, used, remaining, limit, window: win, periodRef };
    }

    // ✅ agora sim incrementa (ou cria)
    const row = await tx.usageCounter.upsert({
      where: {
        userId_key_windowKind_windowStart: { userId, key, windowKind, windowStart },
      },
      create: {
        userId,
        key,
        windowKind,
        windowStart,
        windowEnd,
        periodRef,
        count: 1,
        value: 0,
      },
      update: win === "total"
        ? { count: { increment: 1 }, updatedAt: new Date() }
        : { count: { increment: 1 }, windowEnd, periodRef, updatedAt: new Date() },
      select: { count: true },
    });

    const used = row.count;
    const remaining = Math.max(0, limit - used);
    const allowed = used <= limit;

    return { allowed, used, remaining, limit, window: win, periodRef };
  });
}

export function denyUsage(
  res: Response,
  key: UsageKey,
  ctx: { limit: number; used: number; remaining: number; window: Window; periodRef?: string }
) {
  const capability = CAPABILITY_BY_KEY[key] ?? key;
  const windowStr = WINDOW_LABEL[ctx.window];
  const allowed = ctx.limit;
  const remaining = Math.max(0, ctx.remaining);

  const upgradeHint = UPGRADE_HINT_BY_CAP[capability];

  return sendLimitInfo(res, {
    capability,
    window: windowStr,
    allowed,
    remaining,
    ...(upgradeHint ? { upgradeHint } : {}),
  });
}

export async function touchFairUse(orgId: string, key: UsageKey) {
  const limit = (LIMITS.LEARNING as any)[key] ?? (LIMITS.PRO as any)[key] ?? Infinity;
  const win = WINDOW_BY_KEY[key];
  if (!Number.isFinite(limit)) return { used: 0, limit: Infinity, warn: false };

  const { periodRef, windowKind } = boundsFor(win, new Date());
  const rec = await prisma.usageCounter.findFirst({
    where: { userId: orgId, key, periodRef, windowKind },
    select: { count: true, value: true },
  });

  const used = rec?.count ?? rec?.value ?? 0;
  const warn = used >= Math.floor((Number(limit) as number) * 0.8);
  return { used, limit, warn };
}