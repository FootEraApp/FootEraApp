import { PrismaClient, TipoUsuario } from "@prisma/client";

export type Tier = "bronze" | "prata" | "ouro" | "platina";
export type Entity = "Atleta" | "Professor" | "Escolinha" | "Clube";
export type Group =
  | "Treinos"
  | "Desafios"
  | "Desafios em Grupo"
  | "Pontuação"
  | "Gestão"
  | "Eventos";

export interface Achievement<TStats> {
  id: string;          
  entity: Entity;      
  title: string;          
  description: string;     
  icon?: string;         
  tier?: Tier;            
  group: Group;            
  condition: (s: TStats) => boolean; 
}

export interface AthleteStats {
  atletaId: string;
  treinosConcluidos: number;      
  desafiosConcluidos: number;         
  desafiosGrupoConcluidos: number;   
  pontuacaoTotal: number;
  performance: number;
  disciplina: number;
  responsabilidade: number;
}

export interface ProfessorStats {
  professorId: string;
  treinosCriados: number;           
  atletasTreinados: number;            
  submissoesRecebidas: number;         
  desafiosGrupoCriados: number;        
  usuarioId: string;
}

export interface EscolinhaStats {
  escolinhaId: string;
  atletasVinculados: number;           
  treinosCriados: number;               
  submissoesAtletas: number;           
  desafiosAprovadosAtletas: number;     
}

export interface ClubeStats {
  clubeId: string;
  atletasVinculados: number;         
  treinosCriados: number;         
  eventosOrganizados: number;         
  desafiosAprovadosAtletas: number;   
}

export async function getAthleteStatsByUsuarioId(
  prisma: PrismaClient,
  usuarioId: string
): Promise<AthleteStats | null> {
  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!atleta) return null;

  const [treinosConcluidos, desafiosConcluidos, desafiosGrupoConcluidos, pont] =
    await Promise.all([
      prisma.submissaoTreino.count({ where: { atletaId: atleta.id } }),
      prisma.submissaoDesafio.count({
        where: { atletaId: atleta.id, aprovado: true },
      }),
      prisma.submissaoDesafioEmGrupo.count({
        where: { usuarioId, aprovado: true },
      }),
      prisma.pontuacaoAtleta.findUnique({
        where: { atletaId: atleta.id },
        select: {
          pontuacaoTotal: true,
          pontuacaoPerformance: true,
          pontuacaoDisciplina: true,
          pontuacaoResponsabilidade: true,
        },
      }),
    ]);

  return {
    atletaId: atleta.id,
    treinosConcluidos,
    desafiosConcluidos,
    desafiosGrupoConcluidos,
    pontuacaoTotal: pont?.pontuacaoTotal ?? 0,
    performance: pont?.pontuacaoPerformance ?? 0,
    disciplina: pont?.pontuacaoDisciplina ?? 0,
    responsabilidade: pont?.pontuacaoResponsabilidade ?? 0,
  };
}

export async function getProfessorStatsByUsuarioId(
  prisma: PrismaClient,
  usuarioId: string
): Promise<ProfessorStats | null> {
  const prof = await prisma.professor.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!prof) return null;

  const [treinosCriados, atletasTreinados, submissoesRecebidas, desafiosGrupoCriados] =
    await Promise.all([
      prisma.treinoProgramado.count({ where: { professorId: prof.id } }),
      prisma.relacaoTreinamento.count({
        where: { professorId: prof.id, atletaId: { not: null } },
      }),
      prisma.submissaoTreino.count({
        where: {
          treinoAgendado: {
            treinoProgramado: { professorId: prof.id },
          },
        },
      }),
      prisma.desafioEmGrupo.count({ where: { criadoPorId: usuarioId } }),
    ]);

  return {
    professorId: prof.id,
    treinosCriados,
    atletasTreinados,
    submissoesRecebidas,
    desafiosGrupoCriados,
    usuarioId,
  };
}

export async function getEscolinhaStatsByUsuarioId(
  prisma: PrismaClient,
  usuarioId: string
): Promise<EscolinhaStats | null> {
  const esc = await prisma.escolinha.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!esc) return null;

  const [atletasVinculados, treinosCriados, submissoesAtletas, desafiosAprovadosAtletas] =
    await Promise.all([
      prisma.atleta.count({ where: { escolinhaId: esc.id } }),
      prisma.treinoProgramado.count({ where: { escolinhaId: esc.id } }),
      prisma.submissaoTreino.count({
        where: { atleta: { escolinhaId: esc.id } },
      }),
      prisma.submissaoDesafio.count({
        where: { aprovado: true, atleta: { escolinhaId: esc.id } },
      }),
    ]);

  return {
    escolinhaId: esc.id,
    atletasVinculados,
    treinosCriados,
    submissoesAtletas,
    desafiosAprovadosAtletas,
  };
}

export async function getClubeStatsByUsuarioId(
  prisma: PrismaClient,
  usuarioId: string
): Promise<ClubeStats | null> {
  const club = await prisma.clube.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!club) return null;

  const [atletasVinculados, treinosCriados, eventosOrganizados, desafiosAprovadosAtletas] =
    await Promise.all([
      prisma.atleta.count({ where: { clubeId: club.id } }),
      prisma.treinoProgramado.count({ where: { clubeId: club.id } }),
      prisma.evento.count({ where: { clubeId: club.id } }),
      prisma.submissaoDesafio.count({
        where: { aprovado: true, atleta: { clubeId: club.id } },
      }),
    ]);

  return {
    clubeId: club.id,
    atletasVinculados,
    treinosCriados,
    eventosOrganizados,
    desafiosAprovadosAtletas,
  };
}

export const ATHLETE_ACHIEVEMENTS: Achievement<AthleteStats>[] = [
  {
    id: "ath_train_1",
    entity: "Atleta",
    title: "Primeiro Treino",
    description: "Concluiu 1 treino.",
    icon: "💪",
    tier: "bronze",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 1,
  },
  {
    id: "ath_train_5",
    entity: "Atleta",
    title: "Rotina Iniciada",
    description: "Concluiu 5 treinos.",
    icon: "🏃",
    tier: "bronze",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 5,
  },
  {
    id: "ath_train_10",
    entity: "Atleta",
    title: "Constante",
    description: "Concluiu 10 treinos.",
    icon: "🔥",
    tier: "prata",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 10,
  },
  {
    id: "ath_train_25",
    entity: "Atleta",
    title: "Vício Saudável",
    description: "Concluiu 25 treinos.",
    icon: "🏅",
    tier: "prata",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 25,
  },
  {
    id: "ath_train_50",
    entity: "Atleta",
    title: "Meio-Centenário",
    description: "Concluiu 50 treinos.",
    icon: "🥈",
    tier: "ouro",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 50,
  },
  {
    id: "ath_train_100",
    entity: "Atleta",
    title: "Cem por Cento",
    description: "Concluiu 100 treinos.",
    icon: "🥇",
    tier: "ouro",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 100,
  },
  {
    id: "ath_train_200",
    entity: "Atleta",
    title: "Maratonista",
    description: "Concluiu 200 treinos.",
    icon: "🏆",
    tier: "platina",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 200,
  },

  {
    id: "ath_chal_1",
    entity: "Atleta",
    title: "Desafio Aceito",
    description: "Concluiu 1 desafio oficial.",
    icon: "🎯",
    tier: "bronze",
    group: "Desafios",
    condition: s => s.desafiosConcluidos >= 1,
  },
  {
    id: "ath_chal_3",
    entity: "Atleta",
    title: "Trinca Vencedora",
    description: "Concluiu 3 desafios oficiais.",
    icon: "🥉",
    tier: "bronze",
    group: "Desafios",
    condition: s => s.desafiosConcluidos >= 3,
  },
  {
    id: "ath_chal_5",
    entity: "Atleta",
    title: "Serial Challenger",
    description: "Concluiu 5 desafios oficiais.",
    icon: "💥",
    tier: "prata",
    group: "Desafios",
    condition: s => s.desafiosConcluidos >= 5,
  },
  {
    id: "ath_chal_10",
    entity: "Atleta",
    title: "Top 10",
    description: "Concluiu 10 desafios oficiais.",
    icon: "🏅",
    tier: "ouro",
    group: "Desafios",
    condition: s => s.desafiosConcluidos >= 10,
  },
  {
    id: "ath_chal_20",
    entity: "Atleta",
    title: "Máquina de Desafios",
    description: "Concluiu 20 desafios oficiais.",
    icon: "🏆",
    tier: "platina",
    group: "Desafios",
    condition: s => s.desafiosConcluidos >= 20,
  },

  {
    id: "ath_grp_1",
    entity: "Atleta",
    title: "Time em Campo",
    description: "Concluiu 1 desafio em grupo.",
    icon: "🤝",
    tier: "bronze",
    group: "Desafios em Grupo",
    condition: s => s.desafiosGrupoConcluidos >= 1,
  },
  {
    id: "ath_grp_3",
    entity: "Atleta",
    title: "Entrosado",
    description: "Concluiu 3 desafios em grupo.",
    icon: "🧩",
    tier: "prata",
    group: "Desafios em Grupo",
    condition: s => s.desafiosGrupoConcluidos >= 3,
  },
  {
    id: "ath_grp_5",
    entity: "Atleta",
    title: "Coletivo Forte",
    description: "Concluiu 5 desafios em grupo.",
    icon: "🎽",
    tier: "ouro",
    group: "Desafios em Grupo",
    condition: s => s.desafiosGrupoConcluidos >= 5,
  },
  {
    id: "ath_grp_10",
    entity: "Atleta",
    title: "Capitão de Equipe",
    description: "Concluiu 10 desafios em grupo.",
    icon: "👑",
    tier: "platina",
    group: "Desafios em Grupo",
    condition: s => s.desafiosGrupoConcluidos >= 10,
  },

  {
    id: "ath_pts_total_100",
    entity: "Atleta",
    title: "Cem Pontos",
    description: "Atingiu 100 pontos totais.",
    icon: "🔢",
    tier: "bronze",
    group: "Pontuação",
    condition: s => s.pontuacaoTotal >= 100,
  },
  {
    id: "ath_pts_total_250",
    entity: "Atleta",
    title: "Quarto de Milhar",
    description: "Atingiu 250 pontos totais.",
    icon: "📈",
    tier: "prata",
    group: "Pontuação",
    condition: s => s.pontuacaoTotal >= 250,
  },
  {
    id: "ath_pts_total_500",
    entity: "Atleta",
    title: "Meio Milhar",
    description: "Atingiu 500 pontos totais.",
    icon: "💹",
    tier: "ouro",
    group: "Pontuação",
    condition: s => s.pontuacaoTotal >= 500,
  },
  {
    id: "ath_pts_total_1000",
    entity: "Atleta",
    title: "Milhão em Vista",
    description: "Atingiu 1000 pontos totais.",
    icon: "🏆",
    tier: "platina",
    group: "Pontuação",
    condition: s => s.pontuacaoTotal >= 1000,
  },

  {
    id: "ath_pts_perf_50",
    entity: "Atleta",
    title: "Foco em Performance I",
    description: "50 pts em Performance.",
    icon: "⚙️",
    tier: "bronze",
    group: "Pontuação",
    condition: s => s.performance >= 50,
  },
  {
    id: "ath_pts_perf_100",
    entity: "Atleta",
    title: "Foco em Performance II",
    description: "100 pts em Performance.",
    icon: "⚙️",
    tier: "prata",
    group: "Pontuação",
    condition: s => s.performance >= 100,
  },
  {
    id: "ath_pts_perf_200",
    entity: "Atleta",
    title: "Foco em Performance III",
    description: "200 pts em Performance.",
    icon: "⚙️",
    tier: "ouro",
    group: "Pontuação",
    condition: s => s.performance >= 200,
  },

  {
    id: "ath_pts_disc_50",
    entity: "Atleta",
    title: "Disciplina I",
    description: "50 pts em Disciplina.",
    icon: "⏱️",
    tier: "bronze",
    group: "Pontuação",
    condition: s => s.disciplina >= 50,
  },
  {
    id: "ath_pts_disc_100",
    entity: "Atleta",
    title: "Disciplina II",
    description: "100 pts em Disciplina.",
    icon: "⏱️",
    tier: "prata",
    group: "Pontuação",
    condition: s => s.disciplina >= 100,
  },
  {
    id: "ath_pts_disc_200",
    entity: "Atleta",
    title: "Disciplina III",
    description: "200 pts em Disciplina.",
    icon: "⏱️",
    tier: "ouro",
    group: "Pontuação",
    condition: s => s.disciplina >= 200,
  },

  {
    id: "ath_pts_resp_50",
    entity: "Atleta",
    title: "Responsabilidade I",
    description: "50 pts em Responsabilidade.",
    icon: "📋",
    tier: "bronze",
    group: "Pontuação",
    condition: s => s.responsabilidade >= 50,
  },
  {
    id: "ath_pts_resp_100",
    entity: "Atleta",
    title: "Responsabilidade II",
    description: "100 pts em Responsabilidade.",
    icon: "📋",
    tier: "prata",
    group: "Pontuação",
    condition: s => s.responsabilidade >= 100,
  },
  {
    id: "ath_pts_resp_200",
    entity: "Atleta",
    title: "Responsabilidade III",
    description: "200 pts em Responsabilidade.",
    icon: "📋",
    tier: "ouro",
    group: "Pontuação",
    condition: s => s.responsabilidade >= 200,
  },

  {
    id: "ath_first_submit",
    entity: "Atleta",
    title: "Primeiro Envio",
    description: "Fez a primeira submissão de treino.",
    icon: "🆕",
    tier: "bronze",
    group: "Treinos",
    condition: s => s.treinosConcluidos >= 1,
  },
];

export const PROFESSOR_ACHIEVEMENTS: Achievement<ProfessorStats>[] = [
  {
    id: "prof_tp_1",
    entity: "Professor",
    title: "Primeiro Treino Programado",
    description: "Criou 1 treino programado.",
    icon: "📝",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.treinosCriados >= 1,
  },
  {
    id: "prof_tp_5",
    entity: "Professor",
    title: "Série de Treinos",
    description: "Criou 5 treinos programados.",
    icon: "🗂️",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.treinosCriados >= 5,
  },
  {
    id: "prof_tp_10",
    entity: "Professor",
    title: "Planejamento Sólido",
    description: "Criou 10 treinos programados.",
    icon: "📘",
    tier: "prata",
    group: "Gestão",
    condition: s => s.treinosCriados >= 10,
  },
  {
    id: "prof_tp_25",
    entity: "Professor",
    title: "Catálogo de Sessões",
    description: "Criou 25 treinos programados.",
    icon: "📚",
    tier: "ouro",
    group: "Gestão",
    condition: s => s.treinosCriados >= 25,
  },
  {
    id: "prof_atletas_5",
    entity: "Professor",
    title: "Grupo Inicial",
    description: "Treina 5 atletas (vínculo).",
    icon: "👥",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.atletasTreinados >= 5,
  },
  {
    id: "prof_atletas_10",
    entity: "Professor",
    title: "Turma Cheia",
    description: "Treina 10 atletas (vínculo).",
    icon: "👨‍👩‍👧‍👦",
    tier: "prata",
    group: "Gestão",
    condition: s => s.atletasTreinados >= 10,
  },
  {
    id: "prof_subs_50",
    entity: "Professor",
    title: "Feedback Contínuo",
    description: "Recebeu 50 submissões de treino.",
    icon: "📥",
    tier: "ouro",
    group: "Gestão",
    condition: s => s.submissoesRecebidas >= 50,
  },
  {
    id: "prof_grp_1",
    entity: "Professor",
    title: "Movimenta a Galera",
    description: "Criou 1 desafio em grupo.",
    icon: "🧑‍🤝‍🧑",
    tier: "bronze",
    group: "Desafios em Grupo",
    condition: s => s.desafiosGrupoCriados >= 1,
  },
];

export const ESCOLINHA_ACHIEVEMENTS: Achievement<EscolinhaStats>[] = [
  {
    id: "esc_atletas_10",
    entity: "Escolinha",
    title: "Turma Formada",
    description: "10 atletas vinculados.",
    icon: "🎒",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.atletasVinculados >= 10,
  },
  {
    id: "esc_atletas_25",
    entity: "Escolinha",
    title: "Base Forte",
    description: "25 atletas vinculados.",
    icon: "🏫",
    tier: "prata",
    group: "Gestão",
    condition: s => s.atletasVinculados >= 25,
  },
  {
    id: "esc_tp_1",
    entity: "Escolinha",
    title: "Primeiro Treino da Escolinha",
    description: "Criou 1 treino programado.",
    icon: "📝",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.treinosCriados >= 1,
  },
  {
    id: "esc_tp_10",
    entity: "Escolinha",
    title: "Rotina Estruturada",
    description: "Criou 10 treinos programados.",
    icon: "📘",
    tier: "prata",
    group: "Gestão",
    condition: s => s.treinosCriados >= 10,
  },
  {
    id: "esc_subs_100",
    entity: "Escolinha",
    title: "Quadra Cheia",
    description: "100 submissões de treino de atletas da escolinha.",
    icon: "📥",
    tier: "ouro",
    group: "Gestão",
    condition: s => s.submissoesAtletas >= 100,
  },
  {
    id: "esc_desafios_aprov_10",
    entity: "Escolinha",
    title: "Talentos em Ascensão",
    description: "10 desafios aprovados por atletas da escolinha.",
    icon: "🎯",
    tier: "prata",
    group: "Desafios",
    condition: s => s.desafiosAprovadosAtletas >= 10,
  },
];

export const CLUBE_ACHIEVEMENTS: Achievement<ClubeStats>[] = [
  {
    id: "clu_atletas_10",
    entity: "Clube",
    title: "Olho na Base",
    description: "10 atletas vinculados.",
    icon: "👶",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.atletasVinculados >= 10,
  },
  {
    id: "clu_atletas_25",
    entity: "Clube",
    title: "Elenco em Formação",
    description: "25 atletas vinculados.",
    icon: "🧑‍🎓",
    tier: "prata",
    group: "Gestão",
    condition: s => s.atletasVinculados >= 25,
  },
  {
    id: "clu_tp_1",
    entity: "Clube",
    title: "Primeiro Treino do Clube",
    description: "Criou 1 treino programado.",
    icon: "📝",
    tier: "bronze",
    group: "Gestão",
    condition: s => s.treinosCriados >= 1,
  },
  {
    id: "clu_tp_10",
    entity: "Clube",
    title: "Estratégia de Treinos",
    description: "Criou 10 treinos programados.",
    icon: "📘",
    tier: "prata",
    group: "Gestão",
    condition: s => s.treinosCriados >= 10,
  },
  {
    id: "clu_evento_1",
    entity: "Clube",
    title: "Primeiro Evento",
    description: "Organizou 1 evento.",
    icon: "📅",
    tier: "bronze",
    group: "Eventos",
    condition: s => s.eventosOrganizados >= 1,
  },
  {
    id: "clu_evento_5",
    entity: "Clube",
    title: "Calendário Forte",
    description: "Organizou 5 eventos.",
    icon: "🗓️",
    tier: "prata",
    group: "Eventos",
    condition: s => s.eventosOrganizados >= 5,
  },
];

export type AnyStats = AthleteStats | ProfessorStats | EscolinhaStats | ClubeStats;

export interface ComputeResult<TStats extends AnyStats> {
  stats: TStats;
  earned: Achievement<TStats>[];
  totalAvailable: number;
}

export async function computeAchievementsForUser(
  prisma: PrismaClient,
  usuarioId: string,
  tipo: TipoUsuario
): Promise<ComputeResult<any> | null> {
  if (tipo === "Atleta") {
    const stats = await getAthleteStatsByUsuarioId(prisma, usuarioId);
    if (!stats) return null;
    const earned = ATHLETE_ACHIEVEMENTS.filter(a => a.condition(stats));
    return { stats, earned, totalAvailable: ATHLETE_ACHIEVEMENTS.length };
  }

  if (tipo === "Professor") {
    const stats = await getProfessorStatsByUsuarioId(prisma, usuarioId);
    if (!stats) return null;
    const earned = PROFESSOR_ACHIEVEMENTS.filter(a => a.condition(stats));
    return { stats, earned, totalAvailable: PROFESSOR_ACHIEVEMENTS.length };
  }

  if (tipo === "Escolinha") {
    const stats = await getEscolinhaStatsByUsuarioId(prisma, usuarioId);
    if (!stats) return null;
    const earned = ESCOLINHA_ACHIEVEMENTS.filter(a => a.condition(stats));
    return { stats, earned, totalAvailable: ESCOLINHA_ACHIEVEMENTS.length };
  }

  if (tipo === "Clube") {
    const stats = await getClubeStatsByUsuarioId(prisma, usuarioId);
    if (!stats) return null;
    const earned = CLUBE_ACHIEVEMENTS.filter(a => a.condition(stats));
    return { stats, earned, totalAvailable: CLUBE_ACHIEVEMENTS.length };
  }

  return null;
}

export function makeBadgesHandler(prisma: PrismaClient) {
  return async (req: any, res: any) => {
    try {
      const { usuarioId } = req.params as { usuarioId: string };
      const user = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { tipo: true },
      });
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const result = await computeAchievementsForUser(prisma, usuarioId, user.tipo);
      if (!result) {
        return res.status(200).json({ stats: null, earned: [], totalAvailable: 0 });
      }
      res.json(result);
    } catch (e: any) {
      console.error("badges handler error:", e);
      res.status(500).json({ error: e?.message || "Erro ao calcular badges" });
    }
  };
}