import { PrismaClient } from "@prisma/client";

export type FeatureKey = "SUBMISSAO_DESAFIO" | "TREINO_SALVO";

type EnforceFeatureLimitParams = {
  prisma: PrismaClient;
  feature: FeatureKey;
  plano: string;
  atletaId?: string;
  usuarioId?: string;
};

export interface FeatureLimitError extends Error {
  code: "LIMIT_REACHED";
  capability: FeatureKey;
  window: string;
  allowed: number;
  remaining: number;
}

function makeLimitError(
  feature: FeatureKey,
  allowed: number,
  window: string,
  message: string
): FeatureLimitError {
  const err = new Error(message) as FeatureLimitError;
  err.code = "LIMIT_REACHED";
  err.capability = feature;
  err.window = window;
  err.allowed = allowed;
  err.remaining = 0;
  return err;
}

export async function enforceFeatureLimit({
  prisma,
  feature,
  atletaId,
  usuarioId,
  plano,
}: EnforceFeatureLimitParams): Promise<void> {
  if (String(plano).toUpperCase() !== "FREE") return;

  if (feature === "SUBMISSAO_DESAFIO") {
    if (!atletaId) return;

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const count = await prisma.submissaoDesafio.count({
      where: {
        atletaId,
        createdAt: {
          gte: inicioMes,
          lt: fimMes,
        },
      },
    });

    const LIMIT = 2;
    const WINDOW = "30d";
    if (count >= LIMIT) {
      throw makeLimitError(
        "SUBMISSAO_DESAFIO",
        LIMIT,
        WINDOW,
        "Você atingiu o limite de 2 submissões de desafio no plano Free este mês."
      );
    }
  }

  if (feature === "TREINO_SALVO") {
    const key = usuarioId ?? atletaId;
    if (!key) return;

    const count = await prisma.treinoSalvo.count({
      where: { usuarioId: key },
    });

    const LIMIT = 5;
    const WINDOW = "TOTAL";
    if (count >= LIMIT) {
      throw makeLimitError(
        "TREINO_SALVO",
        LIMIT,
        WINDOW,
        "Você atingiu o limite de 5 treinos salvos na sua biblioteca no plano Free."
      );
    }
  }
}