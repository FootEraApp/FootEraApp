import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { USAGE_MESSAGES, WINDOW_BY_KEY, type WindowKind } from '../services/usage.messages.js';
import { getUserPlan, planLimitFor } from '../services/plan.js';
import { windowBounds } from '../services/usage.js';

const prisma = new PrismaClient();

type Req = Request & { user?: { id?: string } };

export async function getUsage(req: Req, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const keys = String(req.query.keys || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const plan = await getUserPlan(userId);
  const now = new Date();

  const items = await Promise.all(keys.map(async key => {
    const kind = WINDOW_BY_KEY[key];
    if (!kind) return { key, error: 'unknown_key' };

    if (kind === 'TOTAL') {
      return {
        key,
        window: 'TOTAL' as const,
        limit: planLimitFor(plan, key),
        used: null,
        message: USAGE_MESSAGES[key],
      };
    }

    const { windowStart } = windowBounds(kind as WindowKind, now);
    const row = await prisma.usageCounter.findUnique({
      where: { userId_key_windowKind_windowStart: { userId, key, windowKind: kind, windowStart } },
    });

    return {
      key,
      window: kind,
      limit: planLimitFor(plan, key),
      used: row?.count ?? 0,
      message: USAGE_MESSAGES[key],
    };
  }));

  res.json({ plan, items });
}
