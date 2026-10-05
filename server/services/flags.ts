import { prisma } from "../lib/prisma.js";
import { getDailyUsage } from "../services/usage.js";
import { getActiveContext } from "./activeContext.js";

const ADS_CAP_PER_DAY = 5;

export type Capability =
  | "DM"
  | "DM_GRUPO"
  | "SUBMISSAO_TREINO"
  | "SUBMISSAO_DESAFIO"
  | "ADS";

export interface UserFlags {
  plano: string;        
  adsEnabled: boolean;
  capabilities: Capability[];
}

export async function getUserFlags(
  usuarioId: string
): Promise<UserFlags> {
  const contexto =
    await getActiveContext(
      usuarioId
    );

  const assinatura =
    contexto
      ? await prisma.assinatura.findFirst({
          where: {
            usuarioId,
            contextoKey:
              contexto.key,
          },

          orderBy: [
            { ativo: "desc" },
            { renovaEm: "desc" },
            { startsAt: "desc" },
          ],

          select: {
            ativo: true,
            plano: true,
            status: true,
            trialEndsAt: true,
          },
        })
      : null;

  const plano =
    assinatura?.ativo
      ? assinatura.plano ||
        "PRO"
      : "FREE";
  const caps: Capability[] = [
    "DM",
    "DM_GRUPO",
    "SUBMISSAO_TREINO",
    "SUBMISSAO_DESAFIO",
  ];

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