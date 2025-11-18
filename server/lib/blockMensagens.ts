import type { UsageKey } from "./usage.js";

export type BlockReason =
  | UsageKey              
  | "TREINO_SALVO_FREE"
  | "DM_MENOR_SEM_CONSENTIMENTO"
  | "OUTRO";              

export const BLOCK_MESSAGES: Record<BlockReason, string> = {
  treinos_semana:
    "Limite semanal de treinos atingido no plano Free (3 por semana). Faça upgrade para o Pro para liberar ilimitado.",
  desafios_mes:
    "Limite mensal de desafios atingido no plano Free (2 por mês). Faça upgrade para o Pro para liberar ilimitado.",
  treinos_salvos_total:
    "Você atingiu o limite de treinos salvos no plano Free (máx. 5). Exclua um salvo ou faça upgrade.",
  planos_ativos_total:
    "Você atingiu o limite de planos/rotinas ativos no plano Free (máx. 5). Desative um plano ou faça upgrade.",
  templates_total:
    "Você atingiu o limite de templates salvos no plano Free (máx. 10). Remova um template ou faça upgrade.",
  perfis_vistos_dia:
    "Limite diário de perfis visualizados para Olheiro (Free: 20/dia). Faça upgrade para ampliar.",
  listas_salvas_total:
    "Limite de listas salvas atingido no plano Free (máx. 2). Exclua uma lista ou faça upgrade.",
  atletas_vinculados_total:
    "Fair-use: muitos atletas vinculados à organização. Revise seus vínculos.",
  assentos_coach_total:
    "Fair-use: muitos assentos de coach. Revise sua alocação.",
  turmas_total:
    "Fair-use: muitas turmas criadas. Revise sua organização.",
  agendamentos_mes:
    "Fair-use: alto volume de agendamentos este mês.",

  TREINO_SALVO_FREE:
    "Você atingiu o limite de treinos salvos no plano Free. Exclua um ou faça upgrade.",
  DM_MENOR_SEM_CONSENTIMENTO:
    "Por segurança, o contato direto com este atleta menor de idade exige consentimento do responsável.",
  OUTRO:
    "Esta ação está bloqueada pelas regras do seu plano atual.",
};