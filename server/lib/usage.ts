// server/src/lib/usage.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type Window = "day" | "week" | "month";

function periodRef(d = new Date(), win: Window) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  if (win === "day") return `${y}-${m}-${day}`;
  if (win === "month") return `${y}-${m}`;

  // ISO week
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function incAndCheck(userId: string, key: string, limit: number, win: Window) {
  const ref = periodRef(new Date(), win);
  const row = await prisma.usageCounter.upsert({
    where: { userId_key_periodRef: { userId, key, periodRef: ref } },
    update: { value: { increment: 1 }, updatedAt: new Date() },
    create: { userId, key, periodRef: ref, window: win, value: 1 },
  });
  const allowed = row.value <= limit;
  const remaining = Math.max(0, limit - row.value);
  return { allowed, remaining, value: row.value, limit, periodRef: ref };
}
