import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { requireAdmin as guardRequireAdmin } from "./adminGuard.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  return guardRequireAdmin(req as any, res, next);
}