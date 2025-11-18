// server/services/flags.ts
import { prisma } from "../lib/prisma.js";
import { getDailyUsage } from "../services/usage.js";

const ADS_CAP_PER_DAY = 5;

export type Capability =
  | "DM"
  | "DM_GRUPO"
  | "SUBMISSAO_TREINO"
  | "SUBMISSAO_DESAFIO"
  | "ADS";

export interface UserFlags {
  plano: string;          // "FREE" | "PRO" | etc
  adsEnabled: boolean;
  capabilities: Capability[];
}

export async function getUserFlags(usuarioId: string): Promise<UserFlags> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { usuarioId },
    select: { ativo: true, plano: true },
  });

  const plano = assinatura?.ativo ? (assinatura.plano || "PRO") : "FREE";

  const caps: Capability[] = [
    "DM",
    "DM_GRUPO",
    "SUBMISSAO_TREINO",
    "SUBMISSAO_DESAFIO",
  ];

  // Ads só para quem é FREE e ainda tem “slot” de impressão hoje
  const usedToday = await getDailyUsage(usuarioId, "ads_impressions_day");
  const remainingAds = Math.max(0, ADS_CAP_PER_DAY - usedToday);
  const adsEnabled = plano === "FREE" && remainingAds > 0;

  if (adsEnabled) caps.push("ADS");

  return {
    plano,
    adsEnabled,
    capabilities: caps,
  };
}