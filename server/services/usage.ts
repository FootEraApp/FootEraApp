import { PrismaClient } from '@prisma/client';
import { getUserPlan, planLimitFor } from './plan.js';
import { USAGE_MESSAGES, WINDOW_BY_KEY, type WindowKind } from './usage.messages.js';
import { sendLimitInfo } from "../lib/limitInfo.js";

const prisma = new PrismaClient();
const TZ = 'America/Sao_Paulo';

const LIMITS: Record<
  string,
  { capability: string; window: string; allowed: number }
> = {
  treinos_semana: {
    capability: "SUBMISSAO_TREINO",
    window: "7d",
    allowed: 7,
  },
  ads_impressions_day: {
    capability: "ADS",
    window: "1d",
    allowed: 5,
  },
};

function zonedNow(): Date {
  const s = new Date().toLocaleString('en-US', { timeZone: TZ });
  return new Date(s);
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfIsoWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  return x;
}

export function windowBounds(kind: WindowKind, now: Date) {
  if (kind === "DAY") {
    const ws = startOfDay(now);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 1);
    return {
      windowStart: ws,
      windowEnd: we,
      periodRef: ws.toISOString().slice(0, 10),
    };
  }
  if (kind === "WEEK") {
    const ws = startOfIsoWeek(now);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 7);
    const y = ws.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(y, 0, 4));
    const week =
      1 +
      Math.round(
        ((Date.UTC(
          ws.getUTCFullYear(),
          ws.getUTCMonth(),
          ws.getUTCDate()
        ) -
          firstThursday.getTime()) /
          86400000 -
          3) /
          7
      );
    return {
      windowStart: ws,
      windowEnd: we,
      periodRef: `${y}-W${String(week).padStart(2, "0")}`,
    };
  }
  if (kind === "MONTH") {
    const ws = startOfMonth(now);
    const we = new Date(ws);
    we.setMonth(ws.getMonth() + 1);
    const y = ws.getFullYear();
    const m = String(ws.getMonth() + 1).padStart(2, "0");
    return { windowStart: ws, windowEnd: we, periodRef: `${y}-${m}` };
  }
  const ws = new Date(0);
  const we = new Date(8640000000000000);
  return { windowStart: ws, windowEnd: we, periodRef: "TOTAL" };
}

function writeUsageHeaders(
  res: any,
  key: string,
  limit: number,
  remaining: number,
  windowKind: WindowKind
) {
  res.setHeader('X-Usage-Key', key);
  res.setHeader('X-Usage-Limit', String(Number.isFinite(limit) ? limit : -1));
  res.setHeader('X-Usage-Remaining', String(remaining));
  res.setHeader('X-Usage-Window', windowKind);
}

export async function requireUsage(
  req: any,
  res: any,
  key: string
): Promise<boolean> {
  const windowKind = WINDOW_BY_KEY[key];
  if (!windowKind) return true;

  const userId: string = req.user?.id || req.userId;
  if (!userId) {
    res.status(401).json({ code: 'UNAUTHENTICATED' });
    return false;
  }

  const plan = (req.user?.plan as string | undefined) || (await getUserPlan(userId));
  const limit = planLimitFor(plan, key);

  if (windowKind === 'TOTAL') {
    writeUsageHeaders(res, key, limit, Infinity, 'TOTAL');
    return true;
  }

  const now = zonedNow();
  const { windowStart, windowEnd, periodRef } = windowBounds(windowKind, now);

  const counter = await prisma.usageCounter.upsert({
    where: { userId_key_windowKind_windowStart: { userId, key, windowKind, windowStart } },
    update: { count: { increment: 1 }, windowEnd, periodRef, updatedAt: new Date() },
    create: { userId, key, windowKind, windowStart, windowEnd, periodRef, count: 1, value: 0 },
  });

  const used = counter.count;
  const remaining = Number.isFinite(limit)
    ? Math.max(0, limit - used)
    : Number.POSITIVE_INFINITY;

  writeUsageHeaders(res, key, limit, remaining, windowKind);

  const meta =
    LIMITS[key] || {
      capability: key,
      window: String(windowKind).toLowerCase(),
      allowed: Number.isFinite(limit) ? limit : Infinity,
    };

  if (Number.isFinite(limit) && used > limit) {
    sendLimitInfo(res, {
      capability: meta.capability,
      window: meta.window,
      allowed: limit,
      remaining: 0,
    });
    return false;
  }

  return true;
}

export async function enforceTotalLimit(
  req: any,
  res: any,
  key: string,
  currentCountFn: () => Promise<number>
): Promise<boolean> {
  const userId: string = req.user?.id || req.userId;
  if (!userId) {
    res.status(401).json({ code: 'UNAUTHENTICATED' });
    return false;
  }

  const plan = (req.user?.plan as string | undefined) || (await getUserPlan(userId));
  const limit = planLimitFor(plan, key);

  if (!Number.isFinite(limit)) {
    writeUsageHeaders(res, key, limit, Infinity, 'TOTAL');
    return true;
  }

  const count = await currentCountFn();
  const remaining = Math.max(0, limit - count);
  writeUsageHeaders(res, key, limit, remaining, 'TOTAL');

  const meta =
    LIMITS[key] || {
      capability: key,
      window: "TOTAL",
      allowed: limit,
    };

  if (count >= limit) {
    sendLimitInfo(res, {
      capability: meta.capability,
      window: meta.window,
      allowed: limit,
      remaining: 0,
    });
    return false;
  }

  return true;
}

export async function getDailyUsage(userId: string, key: string) {
  const now = zonedNow();
  const { windowStart } = windowBounds("DAY", now as any);
  const row = await prisma.usageCounter.findUnique({
    where: {
      userId_key_windowKind_windowStart: {
        userId,
        key,
        windowKind: "DAY",
        windowStart,
      },
    },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export async function incrementDailyUsage(
  userId: string,
  key: string,
  maxPerDay: number
) {
  const now = zonedNow();
  const { windowStart, windowEnd, periodRef } = windowBounds("DAY", now as any);

  const counter = await prisma.usageCounter.upsert({
    where: {
      userId_key_windowKind_windowStart: {
        userId,
        key,
        windowKind: "DAY",
        windowStart,
      },
    },
    update: {
      count: { increment: 1 },
      windowEnd,
      periodRef,
      updatedAt: new Date(),
    },
    create: {
      userId,
      key,
      windowKind: "DAY",
      windowStart,
      windowEnd,
      periodRef,
      count: 1,
      value: 0,
    },
  });

  const countToday = counter.count;
  const allowed = countToday <= maxPerDay;
  return { allowed, countToday };
}