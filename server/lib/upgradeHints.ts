// server/lib/upgradeHints.ts

export type CapabilityKey =
  | "SUBMISSAO_TREINO"
  | "SUBMISSAO_DESAFIO"
  | "TREINO_SALVO"
  | "ADS";

export const UPGRADE_HINT_BY_CAP: Record<string, string | undefined> = {
  SUBMISSAO_TREINO: "Treinos ilimitados por semana",
  SUBMISSAO_DESAFIO: "Mais tentativas de desafios por mês",
  TREINO_SALVO: "Biblioteca de treinos sem limite",
  ADS: "Experiência sem anúncios",
};
