import { Response } from "express";

export type LimitInfoPayload = {
  capability: string;
  window: string;
  allowed: number;
  remaining: number;
  upgradeHint?: string;
};

export function sendLimitInfo(res: Response, payload: LimitInfoPayload) {
  return res.status(429).json(payload);
}