// server/lib/limitInfo.ts
import { Response } from "express";

export type LimitInfoPayload = {
  capability: string;
  window: string;
  allowed: number;
  remaining: number;
  // vamos acrescentar opcional:
  upgradeHint?: string;
};

export function sendLimitInfo(res: Response, payload: LimitInfoPayload) {
  return res.status(429).json(payload);
}