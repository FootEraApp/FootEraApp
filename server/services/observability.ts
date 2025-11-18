// server/services/observability.ts
import type { AuthenticatedRequest } from "../middlewares/auth.js";

export type CapabilityName = string;

type CapCounters = {
  allowed: number;
  denied: number;
};

type CanLatency = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const capabilityCounters: Record<CapabilityName, CapCounters> = {};
const canLatencies: Record<CapabilityName, CanLatency> = {};

function ensureCap(cap: CapabilityName): CapCounters {
  if (!capabilityCounters[cap]) {
    capabilityCounters[cap] = { allowed: 0, denied: 0 };
  }
  return capabilityCounters[cap];
}

function ensureLatency(cap: CapabilityName): CanLatency {
  if (!canLatencies[cap]) {
    canLatencies[cap] = { count: 0, totalMs: 0, maxMs: 0 };
  }
  return canLatencies[cap];
}

// T13.1.1 – contadores por capability (permitidas/negadas)
export function recordCapabilityDecision(opts: {
  capability: CapabilityName;
  allowed: boolean;
}) {
  const c = ensureCap(opts.capability);
  if (opts.allowed) c.allowed++;
  else c.denied++;
}

// T13.1.1 – latência do can()
export function recordCanLatency(opts: {
  capability: CapabilityName;
  latencyMs: number;
}) {
  const l = ensureLatency(opts.capability);
  l.count++;
  l.totalMs += opts.latencyMs;
  if (opts.latencyMs > l.maxMs) l.maxMs = opts.latencyMs;
}

// T13.1.2 – log estruturado de negação
export function logCapabilityDenied(opts: {
  req: AuthenticatedRequest | null;
  capability: CapabilityName;
  periodRef?: string;
  remaining?: number;
  reason?: string;
}) {
  const user = opts.req?.user as any | undefined;
  const userId = opts.req?.userId ?? user?.id ?? null;
  const tipo = user?.tipo ?? null;
  const plano = user?.plano ?? null;

  const log = {
    level: "warn",
    event: "capability_denied",
    timestamp: new Date().toISOString(),
    userId,
    tipo,
    plano,
    capability: opts.capability,
    periodRef: opts.periodRef ?? "TOTAL",
    remaining: opts.remaining ?? 0,
    reason: opts.reason ?? null,
  };

  // hoje: console, amanhã: enviar pra seu logger/Elastic/etc.
  console.warn(JSON.stringify(log));
}

// Para o dashboard
export function getObservabilitySnapshot() {
  const canStats = Object.entries(canLatencies).map(([cap, l]) => ({
    capability: cap,
    calls: l.count,
    avgMs: l.count ? l.totalMs / l.count : 0,
    maxMs: l.maxMs,
  }));

  const caps = Object.entries(capabilityCounters).map(([cap, c]) => ({
    capability: cap,
    allowed: c.allowed,
    denied: c.denied,
  }));

  return { caps, canStats };
}