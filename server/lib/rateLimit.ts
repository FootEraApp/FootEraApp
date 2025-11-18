import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { sendLimitInfo } from "./limitInfo.js";

interface WindowOptions {
  windowMs: number;
  max: number;
}

type WindowRecord = { count: number; firstHit: number };

const windowHits = new Map<string, WindowRecord>();

function buildWindowLimiter(opts: WindowOptions) {
  return function limiter(feature: string): RequestHandler {
    return (
      req: Request & { userId?: string; user?: any },
      res: Response,
      next: NextFunction
    ) => {
      const ip =
        req.ip || req.socket.remoteAddress || (req.headers["x-forwarded-for"] as string) || "unknown";
      const uid = req.userId || req.user?.id || "anon";

      const identity = `${ip}:${uid}`;
      const key = `${feature}:${identity}`;

      const now = Date.now();
      const rec = windowHits.get(key);

      if (!rec || now - rec.firstHit > opts.windowMs) {
        windowHits.set(key, { count: 1, firstHit: now });
        return next();
      }

      if (rec.count < opts.max) {
        rec.count++;
        return next();
      }

      return sendLimitInfo(res, {
        capability: feature,
        window: `${Math.round(opts.windowMs / 1000)}s`,
        allowed: opts.max,
        remaining: 0,
      });
    };
  };
}

const strictFactory = buildWindowLimiter({ windowMs: 60_000, max: 20 });
const softFactory = buildWindowLimiter({ windowMs: 10_000, max: 60 });

export function strictLimiter(feature: string): RequestHandler {
  return strictFactory(feature);
}

export function softLimiter(feature: string): RequestHandler {
  return softFactory(feature);
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10_000; 
const MAX_REQ = 20;

export function softRateLimit(feature: string): RequestHandler {
  return (req: Request & { userId?: string; user?: any }, res: Response, next: NextFunction) => {
    const ip =
      req.ip || req.socket.remoteAddress || (req.headers["x-forwarded-for"] as string) || "unknown";
    const uid = req.userId || req.user?.id || "anon";

    const key = `${feature}:${ip}:${uid}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
      return next();
    }

    bucket.count++;

    if (bucket.count <= MAX_REQ) {
      return next();
    }

    const remaining = Math.max(0, MAX_REQ - bucket.count);

    return sendLimitInfo(res, {
      capability: feature,
      window: `${Math.round(WINDOW_MS / 1000)}s`,
      allowed: MAX_REQ,
      remaining,
    });
  };
}
