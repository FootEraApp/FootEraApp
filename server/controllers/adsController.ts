// server/controllers/adsController.ts
import type { Request, Response } from "express";
import { incrementDailyUsage } from "../services/usage.js";

const ADS_CAP_PER_DAY = 5;

/**
 * POST /api/ads/impression
 * Registra uma impressão de anúncio para o usuário autenticado.
 */
export async function registrarImpressaoAd(req: Request, res: Response) {
  // auth middleware deve preencher userId ou user.id
  const userId: string | undefined =
    (req as any).userId || (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ code: "UNAUTHENTICATED" });
  }

  try {
    const { allowed, countToday } = await incrementDailyUsage(
      userId,
      "ads_impressions_day",
      ADS_CAP_PER_DAY
    );

    return res.json({
      allowed,                 // se ainda está dentro do limite
      countToday,              // quantas impressões hoje
      remaining: Math.max(0, ADS_CAP_PER_DAY - countToday),
    });
  } catch (err) {
    console.error("registrarImpressaoAd error:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Erro ao registrar impressão de anúncio.",
    });
  }
}
