// server/lib/usage.ts
import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.js"; // <- caminho relativo

const prisma = new PrismaClient();

export type UsageKey =
  | "treinos_semana"          // Atleta
  | "desafios_mes"            // Atleta
  | "treinos_salvos_total"    // Atleta
  | "planos_ativos_total"     // Professor
  | "templates_total"         // Professor
  | "perfis_vistos_dia"       // Olheiro
  | "listas_salvas_total"     // Olheiro
  // fair-use (só aviso)
  | "atletas_vinculados_total"
  | "assentos_coach_total"
  | "turmas_total"
  | "agendamentos_mes";

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
};

const LIMITS = {
  FREE: {
    treinos_semana: 3,
    desafios_mes: 2,
    treinos_salvos_total: 5,
    planos_ativos_total: 5,
    templates_total: 10,
    perfis_vistos_dia: 20,
    listas_salvas_total: 2,
    atletas_vinculados_total: 600,
    assentos_coach_total: 30,
    turmas_total: 30,
    agendamentos_mes: 20000,
  },
  PRO:  {
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
  },
  ORG:  {
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
  },
} as const;

const MSG: Record<UsageKey, string> = {
  treinos_semana:
    "Limite semanal de treinos atingido no plano Free (3 por semana). Faça upgrade para o Pro para liberar ilimitado.",
  desafios_mes:
    "Limite mensal de desafios atingido no plano Free (2 por mês). Faça upgrade para o Pro para liberar ilimitado.",
  treinos_salvos_total:
    "Você atingiu o limite de treinos salvos no plano Free (máx. 5). Exclua um salvo ou faça upgrade.",
  planos_ativos_total:
    "Você atingiu o limite de planos/rotinas ativos no plano Free (máx. 5). Desative um plano ou faça upgrade.",
  templates_total:
    "Você atingiu o limite de templates salvos no plano Free (máx. 10). Remova um template ou faça upgrade.",
  perfis_vistos_dia:
    "Limite diário de perfis visualizados para Olheiro (Free: 20/dia). Faça upgrade para ampliar.",
  listas_salvas_total:
    "Limite de listas salvas atingido no plano Free (máx. 2). Exclua uma lista ou faça upgrade.",
  atletas_vinculados_total:
    "Fair-use: muitos atletas vinculados à organização. Revise seus vínculos.",
  assentos_coach_total:
    "Fair-use: muitos assentos de coach. Revise sua alocação.",
  turmas_total:
    "Fair-use: muitas turmas criadas. Revise sua organização.",
  agendamentos_mes:
    "Fair-use: alto volume de agendamentos este mês.",
};

export function planLimitFor(
  userPlan: "FREE" | "PRO" | "ORG" | null | undefined,
  key: UsageKey
) {
  const plan = (userPlan ?? "FREE") as "FREE" | "PRO" | "ORG";
  const v = (LIMITS[plan] as any)[key];
  return v === Infinity ? Infinity : Number(v ?? Infinity);
}

export function denyUsage(
  res: Response,
  key: UsageKey,
  ctx: { limit: number; used: number; remaining: number; window: Window }
) {
  // caso especial para desafios do mês -> força 402 + UPGRADE_REQUIRED
  if (key === "desafios_mes") {
    return res.status(402).json({
      code: "UPGRADE_REQUIRED",
      key,
      message: MSG[key], // "Limite mensal de desafios atingido no plano Free (2 por mês)..."
      limit: ctx.limit,
      used: ctx.used,
      remaining: ctx.remaining,
      window: ctx.window,
    });
  }

  // padrão para os outros limites
  return res.status(429).json({
    code: "USAGE_LIMIT",
    key,
    message: MSG[key],
    limit: ctx.limit,
    used: ctx.used,
    remaining: ctx.remaining,
    window: ctx.window,
  });
}

// ---- janela/periodRef compatível com o schema (windowKind + windowStart) ----
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
    windowEnd = new Date(8640000000000000);
    periodRef = "TOTAL";
  }
  return { windowStart, windowEnd, periodRef, windowKind: WIN_KIND_MAP[win] };
}

// ----------------- API principal -----------------

export async function requireUsage(
  req: AuthenticatedRequest,
  res: Response,
  key: UsageKey
) {
  const limit = planLimitFor((req.user as any)?.plano as any, key);
  const win = WINDOW_BY_KEY[key];

  if (!Number.isFinite(limit)) {
    return { allowed: true, used: 0, remaining: Infinity, limit: Infinity, window: win };
  }

  const chk = await incAndCheck((req as any).userId!, key, limit, win);
  if (!chk.allowed) {
    denyUsage(res, key, { limit: chk.limit, used: chk.used, remaining: chk.remaining, window: win });
    return null;
  }
  return chk;
}

export async function incAndCheck(
  userId: string,
  key: UsageKey,
  limit: number,
  win: Window
) {
  const { windowStart, windowEnd, periodRef, windowKind } = boundsFor(win, new Date());

  // incrementa se existir; senão cria
  const updated = await prisma.usageCounter.updateMany({
    where: { userId, key, windowKind, windowStart },
    data: { count: { increment: 1 }, windowEnd, periodRef, updatedAt: new Date() },
  });

  if (updated.count === 0) {
    await prisma.usageCounter.create({
      data: { userId, key, windowKind, windowStart, windowEnd, periodRef, count: 1, value: 0 },
    });
  }

  const row = await prisma.usageCounter.findFirst({
    where: { userId, key, windowKind, windowStart },
    select: { count: true },
  });

  const used = row?.count ?? 1;
  const remaining = Math.max(0, limit - used);
  const allowed = used <= limit;

  return { allowed, used, remaining, limit, window: win, periodRef };
}

// alerta “fair-use” (sem bloquear)
export async function touchFairUse(orgId: string, key: UsageKey) {
  const limit = (LIMITS.ORG as any)[key] ?? (LIMITS.PRO as any)[key] ?? Infinity;
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