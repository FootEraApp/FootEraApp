export type Tier = "bronze" | "prata" | "ouro" | "platina";
export type Entity = "Atleta" | "Professor" | "Escolinha" | "Clube";
export type Group =
  | "Treinos"
  | "Desafios"
  | "Desafios em Grupo"
  | "Pontuação"
  | "Gestão"
  | "Eventos";

export interface AchievementLite {
  id: string;
  entity: Entity;
  title: string;
  description: string;
  icon?: string;
  tier?: Tier;
  group: Group;
}

const ATHLETE: AchievementLite[] = [
  { id: "ath_train_1",   entity: "Atleta", title: "Primeiro Treino",     description: "Concluiu 1 treino.",       icon: "💪", tier: "bronze", group: "Treinos" },
  { id: "ath_train_5",   entity: "Atleta", title: "Rotina Iniciada",     description: "Concluiu 5 treinos.",      icon: "🏃", tier: "bronze", group: "Treinos" },
  { id: "ath_train_10",  entity: "Atleta", title: "Constante",           description: "Concluiu 10 treinos.",     icon: "🔥", tier: "prata",  group: "Treinos" },
  { id: "ath_train_25",  entity: "Atleta", title: "Vício Saudável",      description: "Concluiu 25 treinos.",     icon: "🏅", tier: "prata",  group: "Treinos" },
  { id: "ath_train_50",  entity: "Atleta", title: "Meio-Centenário",     description: "Concluiu 50 treinos.",     icon: "🥈", tier: "ouro",   group: "Treinos" },
  { id: "ath_train_100", entity: "Atleta", title: "Cem por Cento",       description: "Concluiu 100 treinos.",    icon: "🥇", tier: "ouro",   group: "Treinos" },
  { id: "ath_train_200", entity: "Atleta", title: "Maratonista",         description: "Concluiu 200 treinos.",    icon: "🏆", tier: "platina", group: "Treinos" },

  { id: "ath_chal_1",  entity: "Atleta", title: "Desafio Aceito",      description: "Concluiu 1 desafio oficial.",  icon: "🎯", tier: "bronze", group: "Desafios" },
  { id: "ath_chal_3",  entity: "Atleta", title: "Trinca Vencedora",    description: "Concluiu 3 desafios oficiais.", icon: "🥉", tier: "bronze", group: "Desafios" },
  { id: "ath_chal_5",  entity: "Atleta", title: "Serial Challenger",   description: "Concluiu 5 desafios oficiais.", icon: "💥", tier: "prata",  group: "Desafios" },
  { id: "ath_chal_10", entity: "Atleta", title: "Top 10",              description: "Concluiu 10 desafios oficiais.", icon: "🏅", tier: "ouro",   group: "Desafios" },
  { id: "ath_chal_20", entity: "Atleta", title: "Máquina de Desafios", description: "Concluiu 20 desafios oficiais.", icon: "🏆", tier: "platina", group: "Desafios" },

  { id: "ath_grp_1",  entity: "Atleta", title: "Time em Campo",     description: "Concluiu 1 desafio em grupo.",  icon: "🤝", tier: "bronze", group: "Desafios em Grupo" },
  { id: "ath_grp_3",  entity: "Atleta", title: "Entrosado",         description: "Concluiu 3 desafios em grupo.", icon: "🧩", tier: "prata",  group: "Desafios em Grupo" },
  { id: "ath_grp_5",  entity: "Atleta", title: "Coletivo Forte",    description: "Concluiu 5 desafios em grupo.", icon: "🎽", tier: "ouro",   group: "Desafios em Grupo" },
  { id: "ath_grp_10", entity: "Atleta", title: "Capitão de Equipe", description: "Concluiu 10 desafios em grupo.", icon: "👑", tier: "platina", group: "Desafios em Grupo" },

  { id: "ath_pts_total_100",  entity: "Atleta", title: "Cem Pontos",        description: "Atingiu 100 pontos totais.",  icon: "🔢", tier: "bronze", group: "Pontuação" },
  { id: "ath_pts_total_250",  entity: "Atleta", title: "Quarto de Milhar",  description: "Atingiu 250 pontos totais.",  icon: "📈", tier: "prata",  group: "Pontuação" },
  { id: "ath_pts_total_500",  entity: "Atleta", title: "Meio Milhar",       description: "Atingiu 500 pontos totais.",  icon: "💹", tier: "ouro",   group: "Pontuação" },
  { id: "ath_pts_total_1000", entity: "Atleta", title: "Milhão em Vista",   description: "Atingiu 1000 pontos totais.", icon: "🏆", tier: "platina", group: "Pontuação" },

  { id: "ath_pts_perf_50",  entity: "Atleta", title: "Foco em Performance I",  description: "50 pts em Performance.",  icon: "⚙️", tier: "bronze", group: "Pontuação" },
  { id: "ath_pts_perf_100", entity: "Atleta", title: "Foco em Performance II", description: "100 pts em Performance.", icon: "⚙️", tier: "prata",  group: "Pontuação" },
  { id: "ath_pts_perf_200", entity: "Atleta", title: "Foco em Performance III", description: "200 pts em Performance.", icon: "⚙️", tier: "ouro",   group: "Pontuação" },

  { id: "ath_pts_disc_50",  entity: "Atleta", title: "Disciplina I",   description: "50 pts em Disciplina.",  icon: "⏱️", tier: "bronze", group: "Pontuação" },
  { id: "ath_pts_disc_100", entity: "Atleta", title: "Disciplina II",  description: "100 pts em Disciplina.", icon: "⏱️", tier: "prata",  group: "Pontuação" },
  { id: "ath_pts_disc_200", entity: "Atleta", title: "Disciplina III", description: "200 pts em Disciplina.", icon: "⏱️", tier: "ouro",   group: "Pontuação" },

  { id: "ath_pts_resp_50",  entity: "Atleta", title: "Responsabilidade I",   description: "50 pts em Responsabilidade.",  icon: "📋", tier: "bronze", group: "Pontuação" },
  { id: "ath_pts_resp_100", entity: "Atleta", title: "Responsabilidade II",  description: "100 pts em Responsabilidade.", icon: "📋", tier: "prata",  group: "Pontuação" },
  { id: "ath_pts_resp_200", entity: "Atleta", title: "Responsabilidade III", description: "200 pts em Responsabilidade.", icon: "📋", tier: "ouro",   group: "Pontuação" },

  { id: "ath_first_submit", entity: "Atleta", title: "Primeiro Envio", description: "Fez a primeira submissão de treino.", icon: "🆕", tier: "bronze", group: "Treinos" },
];

const PROFESSOR: AchievementLite[] = [
  { id: "prof_tp_1",   entity: "Professor", title: "Primeiro Treino Programado", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão" },
  { id: "prof_tp_5",   entity: "Professor", title: "Série de Treinos",           description: "Criou 5 treinos programados.", icon: "🗂️", tier: "bronze", group: "Gestão" },
  { id: "prof_tp_10",  entity: "Professor", title: "Planejamento Sólido",        description: "Criou 10 treinos programados.", icon: "📘", tier: "prata",  group: "Gestão" },
  { id: "prof_tp_25",  entity: "Professor", title: "Catálogo de Sessões",        description: "Criou 25 treinos programados.", icon: "📚", tier: "ouro",   group: "Gestão" },
  { id: "prof_atletas_5",  entity: "Professor", title: "Grupo Inicial",          description: "Treina 5 atletas (vínculo).",    icon: "👥", tier: "bronze", group: "Gestão" },
  { id: "prof_atletas_10", entity: "Professor", title: "Turma Cheia",            description: "Treina 10 atletas (vínculo).",   icon: "👨‍👩‍👧‍👦", tier: "prata", group: "Gestão" },
  { id: "prof_subs_50",    entity: "Professor", title: "Feedback Contínuo",      description: "Recebeu 50 submissões de treino.", icon: "📥", tier: "ouro", group: "Gestão" },
  { id: "prof_grp_1",      entity: "Professor", title: "Movimenta a Galera",     description: "Criou 1 desafio em grupo.",      icon: "🧑‍🤝‍🧑", tier: "bronze", group: "Desafios em Grupo" },
];

const ESCOLINHA: AchievementLite[] = [
  { id: "esc_atletas_10", entity: "Escolinha", title: "Turma Formada",        description: "10 atletas vinculados.", icon: "🎒", tier: "bronze", group: "Gestão" },
  { id: "esc_atletas_25", entity: "Escolinha", title: "Base Forte",           description: "25 atletas vinculados.", icon: "🏫", tier: "prata",  group: "Gestão" },
  { id: "esc_tp_1",       entity: "Escolinha", title: "Primeiro Treino da Escolinha", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão" },
  { id: "esc_tp_10",      entity: "Escolinha", title: "Rotina Estruturada",   description: "Criou 10 treinos programados.", icon: "📘", tier: "prata", group: "Gestão" },
  { id: "esc_subs_100",   entity: "Escolinha", title: "Quadra Cheia",         description: "100 submissões de treino de atletas da escolinha.", icon: "📥", tier: "ouro", group: "Gestão" },
  { id: "esc_desafios_aprov_10", entity: "Escolinha", title: "Talentos em Ascensão", description: "10 desafios aprovados por atletas da escolinha.", icon: "🎯", tier: "prata", group: "Desafios" },
];

const CLUBE: AchievementLite[] = [
  { id: "clu_atletas_10", entity: "Clube", title: "Olho na Base",        description: "10 atletas vinculados.", icon: "👶", tier: "bronze", group: "Gestão" },
  { id: "clu_atletas_25", entity: "Clube", title: "Elenco em Formação",  description: "25 atletas vinculados.", icon: "🧑‍🎓", tier: "prata",  group: "Gestão" },
  { id: "clu_tp_1",       entity: "Clube", title: "Primeiro Treino do Clube", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão" },
  { id: "clu_tp_10",      entity: "Clube", title: "Estratégia de Treinos", description: "Criou 10 treinos programados.", icon: "📘", tier: "prata", group: "Gestão" },
  { id: "clu_evento_1",   entity: "Clube", title: "Primeiro Evento",     description: "Organizou 1 evento.", icon: "📅", tier: "bronze", group: "Eventos" },
  { id: "clu_evento_5",   entity: "Clube", title: "Calendário Forte",    description: "Organizou 5 eventos.", icon: "🗓️", tier: "prata",  group: "Eventos" },
];

export const ALL_ACHIEVEMENTS: AchievementLite[] = [
  ...ATHLETE,
  ...PROFESSOR,
  ...ESCOLINHA,
  ...CLUBE,
];

export function entityFromTipoUsuario(tipo: string): Entity | null {
  const t = (tipo || "").toLowerCase().trim();
  if (t === "atleta") return "Atleta";
  if (t === "professor") return "Professor";
  if (t === "escolinha") return "Escolinha";
  if (t === "clube") return "Clube";
  return null;
}
