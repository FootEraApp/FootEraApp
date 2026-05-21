import { PrismaClient, ConquistaOwnerTipo, ConquistaTipo } from "@prisma/client";

const prisma = new PrismaClient();

type OldAchievement = {
  id: string;
  entity:
    | "Atleta"
    | "Professor"
    | "Clube"
    | "Escolinha"
    | "Learning"
    | "Marca"
    | "Federacao";
  title: string;
  description: string;
  icon?: string | null;
  tier?: string;
  group?: string;
  meta?: number | null;
};

function mapOwnerTipo(entity: OldAchievement["entity"]): ConquistaOwnerTipo {
  return entity as unknown as ConquistaOwnerTipo;
}

function mapConquistaTipo(group?: string): ConquistaTipo {
  const g = (group ?? "").toLowerCase();

  if (g.includes("treino")) return ConquistaTipo.TREINO;
  if (g.includes("desafio")) return ConquistaTipo.DESAFIO;
  if (g.includes("pontua")) return ConquistaTipo.PERFIL;
  if (g.includes("gest") || g.includes("event")) return ConquistaTipo.ORGANIZACAO;

  return ConquistaTipo.GERAL;
}

function buildDescricao(base: string, group?: string, tier?: string) {
  const extra: string[] = [];
  if (group) extra.push(`Grupo: ${group}`);
  if (tier) extra.push(`Tier: ${tier}`);
  if (!extra.length) return base;
  return `${base}\n\n${extra.join(" • ")}`;
}

function inferMetaFromCodigo(codigo: string): number | null {
  const m = String(codigo).match(/_(\d+)(?:$|_)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function seedConquistasCatalog() {
  const achievements: OldAchievement[] = [
    { id: "ath_train_1", entity: "Atleta", title: "Primeiro Treino", description: "Concluiu 1 treino.", icon: "💪", tier: "bronze", group: "Treinos", meta: 1 },
    { id: "ath_train_5", entity: "Atleta", title: "Rotina Iniciada", description: "Concluiu 5 treinos.", icon: "🏃", tier: "bronze", group: "Treinos", meta: 5 },
    { id: "ath_train_10", entity: "Atleta", title: "Constante", description: "Concluiu 10 treinos.", icon: "🔥", tier: "prata", group: "Treinos", meta: 10 },
    { id: "ath_train_25", entity: "Atleta", title: "Vício Saudável", description: "Concluiu 25 treinos.", icon: "🏅", tier: "prata", group: "Treinos", meta: 25 },
    { id: "ath_train_50", entity: "Atleta", title: "Meio-Centenário", description: "Concluiu 50 treinos.", icon: "🥈", tier: "ouro", group: "Treinos", meta: 50 },
    { id: "ath_train_100", entity: "Atleta", title: "Cem por Cento", description: "Concluiu 100 treinos.", icon: "🥇", tier: "ouro", group: "Treinos", meta: 100 },
    { id: "ath_train_200", entity: "Atleta", title: "Maratonista", description: "Concluiu 200 treinos.", icon: "🏆", tier: "platina", group: "Treinos", meta: 200 },
    { id: "ath_train_365", entity: "Atleta", title: "Ano de Treino", description: "Concluiu 365 treinos.", icon: "📆", tier: "platina", group: "Treinos", meta: 365 },
    { id: "ath_first_submit", entity: "Atleta", title: "Primeiro Envio", description: "Fez a primeira submissão de treino.", icon: "🆕", tier: "bronze", group: "Treinos", meta: 1 },

    { id: "ath_chal_1", entity: "Atleta", title: "Desafio Aceito", description: "Concluiu 1 desafio oficial.", icon: "🎯", tier: "bronze", group: "Desafios", meta: 1 },
    { id: "ath_chal_3", entity: "Atleta", title: "Trinca Vencedora", description: "Concluiu 3 desafios oficiais.", icon: "🥉", tier: "bronze", group: "Desafios", meta: 3 },
    { id: "ath_chal_5", entity: "Atleta", title: "Serial Challenger", description: "Concluiu 5 desafios oficiais.", icon: "💥", tier: "prata", group: "Desafios", meta: 5 },
    { id: "ath_chal_10", entity: "Atleta", title: "Top 10", description: "Concluiu 10 desafios oficiais.", icon: "🏅", tier: "ouro", group: "Desafios", meta: 10 },
    { id: "ath_chal_20", entity: "Atleta", title: "Máquina de Desafios", description: "Concluiu 20 desafios oficiais.", icon: "🏆", tier: "platina", group: "Desafios", meta: 20 },

    { id: "ath_chal_send_try1", entity: "Atleta", title: "Primeiro Take (Enviado)", description: "Enviou um desafio gravado em 1ª tentativa.", icon: "🎬", tier: "bronze", group: "Desafios", meta: 1 },
    { id: "ath_chal_send_try2", entity: "Atleta", title: "Vai na Segunda (Enviado)", description: "Enviou um desafio gravado em 2ª tentativa.", icon: "🔁", tier: "bronze", group: "Desafios", meta: 1 },
    { id: "ath_chal_valid_try1_1", entity: "Atleta", title: "Primeiro Take", description: "Teve 1 desafio aprovado de 1ª tentativa.", icon: "🎯", tier: "bronze", group: "Desafios", meta: 1 },
    { id: "ath_chal_valid_try1_5", entity: "Atleta", title: "Cinco de Primeira", description: "Teve 5 desafios aprovados de 1ª tentativa.", icon: "🏅", tier: "prata", group: "Desafios", meta: 5 },
    { id: "ath_chal_valid_try1_10", entity: "Atleta", title: "Dez de Primeira", description: "Teve 10 desafios aprovados de 1ª tentativa.", icon: "🥇", tier: "ouro", group: "Desafios", meta: 10 },
    { id: "ath_chal_valid_try1_20", entity: "Atleta", title: "Impecável", description: "Teve 20 desafios aprovados de 1ª tentativa.", icon: "🏆", tier: "platina", group: "Desafios", meta: 20 },

    { id: "ath_chal_valid_try2_1", entity: "Atleta", title: "Valeu a Segunda", description: "Teve 1 desafio aprovado de 2ª tentativa.", icon: "🩹", tier: "bronze", group: "Desafios", meta: 1 },
    { id: "ath_chal_valid_try2_5", entity: "Atleta", title: "Resiliente", description: "Teve 5 desafios aprovados de 2ª tentativa.", icon: "🔁", tier: "prata", group: "Desafios", meta: 5 },
    { id: "ath_chal_valid_try2_10", entity: "Atleta", title: "Persistente", description: "Teve 10 desafios aprovados de 2ª tentativa.", icon: "💪", tier: "ouro", group: "Desafios", meta: 10 },

    { id: "ath_grp_1", entity: "Atleta", title: "Time em Campo", description: "Concluiu 1 desafio em grupo.", icon: "🤝", tier: "bronze", group: "Desafios em Grupo", meta: 1 },
    { id: "ath_grp_3", entity: "Atleta", title: "Entrosado", description: "Concluiu 3 desafios em grupo.", icon: "🧩", tier: "prata", group: "Desafios em Grupo", meta: 3 },
    { id: "ath_grp_5", entity: "Atleta", title: "Coletivo Forte", description: "Concluiu 5 desafios em grupo.", icon: "🎽", tier: "ouro", group: "Desafios em Grupo", meta: 5 },
    { id: "ath_grp_10", entity: "Atleta", title: "Capitão de Equipe", description: "Concluiu 10 desafios em grupo.", icon: "👑", tier: "platina", group: "Desafios em Grupo", meta: 10 },
    { id: "ath_grp_25", entity: "Atleta", title: "Líder de Grupo", description: "Concluiu 25 desafios em grupo.", icon: "🧠", tier: "platina", group: "Desafios em Grupo", meta: 25 },

    { id: "ath_pts_total_100", entity: "Atleta", title: "Cem Pontos", description: "Atingiu 100 pontos totais.", icon: "🔢", tier: "bronze", group: "Pontuação", meta: 100 },
    { id: "ath_pts_total_250", entity: "Atleta", title: "Quarto de Milhar", description: "Atingiu 250 pontos totais.", icon: "📈", tier: "prata", group: "Pontuação", meta: 250 },
    { id: "ath_pts_total_500", entity: "Atleta", title: "Meio Milhar", description: "Atingiu 500 pontos totais.", icon: "💹", tier: "ouro", group: "Pontuação", meta: 500 },
    { id: "ath_pts_total_1000", entity: "Atleta", title: "Milhão em Vista", description: "Atingiu 1000 pontos totais.", icon: "🏆", tier: "platina", group: "Pontuação", meta: 1000 },
    { id: "ath_pts_total_2000", entity: "Atleta", title: "Dois Mil Pontos", description: "Atingiu 2000 pontos totais.", icon: "💠", tier: "platina", group: "Pontuação", meta: 2000 },

    { id: "ath_pts_perf_50", entity: "Atleta", title: "Foco em Performance I", description: "50 pts em Performance.", icon: "⚙️", tier: "bronze", group: "Pontuação", meta: 50 },
    { id: "ath_pts_perf_100", entity: "Atleta", title: "Foco em Performance II", description: "100 pts em Performance.", icon: "⚙️", tier: "prata", group: "Pontuação", meta: 100 },
    { id: "ath_pts_perf_200", entity: "Atleta", title: "Foco em Performance III", description: "200 pts em Performance.", icon: "⚙️", tier: "ouro", group: "Pontuação", meta: 200 },

    { id: "ath_pts_disc_50", entity: "Atleta", title: "Disciplina I", description: "50 pts em Disciplina.", icon: "⏱️", tier: "bronze", group: "Pontuação", meta: 50 },
    { id: "ath_pts_disc_100", entity: "Atleta", title: "Disciplina II", description: "100 pts em Disciplina.", icon: "⏱️", tier: "prata", group: "Pontuação", meta: 100 },
    { id: "ath_pts_disc_200", entity: "Atleta", title: "Disciplina III", description: "200 pts em Disciplina.", icon: "⏱️", tier: "ouro", group: "Pontuação", meta: 200 },

    { id: "ath_pts_resp_50", entity: "Atleta", title: "Responsabilidade I", description: "50 pts em Responsabilidade.", icon: "📋", tier: "bronze", group: "Pontuação", meta: 50 },
    { id: "ath_pts_resp_100", entity: "Atleta", title: "Responsabilidade II", description: "100 pts em Responsabilidade.", icon: "📋", tier: "prata", group: "Pontuação", meta: 100 },
    { id: "ath_pts_resp_200", entity: "Atleta", title: "Responsabilidade III", description: "200 pts em Responsabilidade.", icon: "📋", tier: "ouro", group: "Pontuação", meta: 200 },

    { id: "prof_tp_1", entity: "Professor", title: "Primeiro Treino Programado", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão", meta: 1 },
    { id: "prof_tp_5", entity: "Professor", title: "Série de Treinos", description: "Criou 5 treinos programados.", icon: "🗂️", tier: "bronze", group: "Gestão", meta: 5 },
    { id: "prof_tp_10", entity: "Professor", title: "Planejamento Sólido", description: "Criou 10 treinos programados.", icon: "📘", tier: "prata", group: "Gestão", meta: 10 },
    { id: "prof_tp_25", entity: "Professor", title: "Catálogo de Sessões", description: "Criou 25 treinos programados.", icon: "📚", tier: "ouro", group: "Gestão", meta: 25 },
    { id: "prof_tp_50", entity: "Professor", title: "Biblioteca de Treinos", description: "Criou 50 treinos programados.", icon: "🏗️", tier: "platina", group: "Gestão", meta: 50 },

    { id: "prof_atletas_5", entity: "Professor", title: "Grupo Inicial", description: "Treina 5 atletas (vínculo).", icon: "👥", tier: "bronze", group: "Gestão", meta: 5 },
    { id: "prof_atletas_10", entity: "Professor", title: "Turma Cheia", description: "Treina 10 atletas (vínculo).", icon: "👨‍👩‍👧‍👦", tier: "prata", group: "Gestão", meta: 10 },
    { id: "prof_atletas_25", entity: "Professor", title: "Mentor de Elenco", description: "Treina 25 atletas (vínculo).", icon: "🧑‍🏫", tier: "ouro", group: "Gestão", meta: 25 },

    { id: "prof_subs_50", entity: "Professor", title: "Feedback Contínuo", description: "Recebeu 50 submissões de treino.", icon: "📥", tier: "ouro", group: "Gestão", meta: 50 },
    { id: "prof_subs_200", entity: "Professor", title: "Central de Avaliações", description: "Recebeu 200 submissões de treino.", icon: "🧾", tier: "platina", group: "Gestão", meta: 200 },

    { id: "prof_grp_1", entity: "Professor", title: "Movimenta a Galera", description: ( "Criou 1 desafio em grupo." ), icon: "🧑‍🤝‍🧑", tier: "bronze", group: "Desafios em Grupo", meta: 1 },
    { id: "prof_grp_5", entity: "Professor", title: "Campeonato Interno", description: "Criou 5 desafios em grupo.", icon: "🏟️", tier: "ouro", group: "Desafios em Grupo", meta: 5 },

    { id: "esc_atletas_10", entity: "Escolinha", title: "Turma Formada", description: "10 atletas vinculados.", icon: "🎒", tier: "bronze", group: "Gestão", meta: 10 },
    { id: "esc_atletas_25", entity: "Escolinha", title: "Base Forte", description: "25 atletas vinculados.", icon: "🏫", tier: "prata", group: "Gestão", meta: 25 },
    { id: "esc_atletas_50", entity: "Escolinha", title: "Centro de Formação", description: "50 atletas vinculados.", icon: "🏟️", tier: "ouro", group: "Gestão", meta: 50 },

    { id: "esc_tp_1", entity: "Escolinha", title: "Primeiro Treino da Escolinha", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão", meta: 1 },
    { id: "esc_tp_10", entity: "Escolinha", title: "Rotina Estruturada", description: "Criou 10 treinos programados.", icon: "📘", tier: "prata", group: "Gestão", meta: 10 },
    { id: "esc_tp_25", entity: "Escolinha", title: "Programa Completo", description: "Criou 25 treinos programados.", icon: "🧩", tier: "ouro", group: "Gestão", meta: 25 },

    { id: "esc_evento_1", entity: "Escolinha", title: "Primeiro Evento", description: "Organizou 1 evento.", icon: "📅", tier: "bronze", group: "Eventos", meta: 1 },
    { id: "esc_evento_5", entity: "Escolinha", title: "Calendário Forte", description: "Organizou 5 eventos.", icon: "🗓️", tier: "prata", group: "Eventos", meta: 5 },
    { id: "esc_evento_10", entity: "Escolinha", title: "Clube Ativo", description: "Organizou 10 eventos.", icon: "🎟️", tier: "ouro", group: "Eventos", meta: 10 },
    { id: "esc_evento_25", entity: "Escolinha", title: "Agenda Lotada", description: "Organizou 25 eventos.", icon: "🏟️", tier: "platina", group: "Eventos", meta: 25 },
    
    { id: "esc_subs_100", entity: "Escolinha", title: "Quadra Cheia", description: "100 submissões de treino de atletas da escolinha.", icon: "📥", tier: "ouro", group: "Gestão", meta: 100 },
    { id: "esc_subs_300", entity: "Escolinha", title: "Ritmo de Competição", description: "300 submissões de treino de atletas da escolinha.", icon: "📦", tier: "platina", group: "Gestão", meta: 300 },

    { id: "esc_desafios_aprov_10", entity: "Escolinha", title: "Talentos em Ascensão", description: "10 desafios aprovados por atletas da escolinha.", icon: "🎯", tier: "prata", group: "Desafios", meta: 10 },
    { id: "esc_desafios_aprov_50", entity: "Escolinha", title: "Lapidando Craques", description: "50 desafios aprovados por atletas da escolinha.", icon: "💎", tier: "platina", group: "Desafios", meta: 50 },

    { id: "clu_atletas_10", entity: "Clube", title: "Olho na Base", description: "10 atletas vinculados.", icon: "👶", tier: "bronze", group: "Gestão", meta: 10 },
    { id: "clu_atletas_25", entity: "Clube", title: "Elenco em Formação", description: "25 atletas vinculados.", icon: "🧑‍🎓", tier: "prata", group: "Gestão", meta: 25 },
    { id: "clu_atletas_50", entity: "Clube", title: "Projeto de Base", description: "50 atletas vinculados.", icon: "🌱", tier: "ouro", group: "Gestão", meta: 50 },

    { id: "clu_tp_1", entity: "Clube", title: "Primeiro Treino do Clube", description: "Criou 1 treino programado.", icon: "📝", tier: "bronze", group: "Gestão", meta: 1 },
    { id: "clu_tp_10", entity: "Clube", title: "Estratégia de Treinos", description: "Criou 10 treinos programados.", icon: "📘", tier: "prata", group: "Gestão", meta: 10 },
    { id: "clu_tp_25", entity: "Clube", title: "Método do Clube", description: "Criou 25 treinos programados.", icon: "📚", tier: "ouro", group: "Gestão", meta: 25 },

    { id: "clu_evento_1", entity: "Clube", title: "Primeiro Evento", description: "Organizou 1 evento.", icon: "📅", tier: "bronze", group: "Eventos", meta: 1 },
    { id: "clu_evento_5", entity: "Clube", title: "Calendário Forte", description: "Organizou 5 eventos.", icon: "🗓️", tier: "prata", group: "Eventos", meta: 5 },
    { id: "clu_evento_10", entity: "Clube", title: "Clube Ativo", description: "Organizou 10 eventos.", icon: "🎟️", tier: "ouro", group: "Eventos", meta: 10 },
    { id: "clu_evento_25", entity: "Clube", title: "Agenda Lotada", description: "Organizou 25 eventos.", icon: "🏟️", tier: "platina", group: "Eventos", meta: 25 },

    // LEARNING
    {
      id: "learn_first_course",
      entity: "Learning",
      title: "Primeiro Curso",
      description: "Iniciou o primeiro curso/metodologia na FootEra.",
      icon: "🎓",
      tier: "bronze",
      group: "Learning",
      meta: 1,
    },
    {
      id: "learn_course_done_1",
      entity: "Learning",
      title: "Primeira Formação",
      description: "Concluiu 1 curso/metodologia.",
      icon: "✅",
      tier: "bronze",
      group: "Learning",
      meta: 1,
    },
    {
      id: "learn_course_done_5",
      entity: "Learning",
      title: "Aluno Dedicado",
      description: "Concluiu 5 cursos/metodologias.",
      icon: "📚",
      tier: "prata",
      group: "Learning",
      meta: 5,
    },
    {
      id: "learn_cert_1",
      entity: "Learning",
      title: "Certificado na Mão",
      description: "Recebeu o primeiro certificado.",
      icon: "📜",
      tier: "bronze",
      group: "Learning",
      meta: 1,
    },

    // MARCA
    {
      id: "brand_profile_complete",
      entity: "Marca",
      title: "Marca Apresentada",
      description: "Completou as informações principais do perfil da marca.",
      icon: "🏷️",
      tier: "bronze",
      group: "Gestão",
      meta: 1,
    },
    {
      id: "brand_first_content",
      entity: "Marca",
      title: "Primeiro Conteúdo",
      description: "Publicou ou criou o primeiro conteúdo/metodologia como marca.",
      icon: "📣",
      tier: "bronze",
      group: "Gestão",
      meta: 1,
    },
    {
      id: "brand_5_contents",
      entity: "Marca",
      title: "Marca Educadora",
      description: "Criou 5 conteúdos/metodologias.",
      icon: "🚀",
      tier: "prata",
      group: "Gestão",
      meta: 5,
    },
    {
      id: "brand_first_event",
      entity: "Marca",
      title: "Primeiro Evento",
      description: "Criou ou participou da organização do primeiro evento.",
      icon: "🏟️",
      tier: "bronze",
      group: "Eventos",
      meta: 1,
    },
    {
      id: "brand_5_events",
      entity: "Marca",
      title: "Calendário Ativo",
      description: "Criou ou participou da organização de 5 eventos.",
      icon: "📅",
      tier: "prata",
      group: "Eventos",
      meta: 5,
    },

    // FEDERAÇÃO
    {
      id: "fed_profile_complete",
      entity: "Federacao",
      title: "Federação Verificada",
      description: "Completou as informações principais do perfil da federação.",
      icon: "🛡️",
      tier: "bronze",
      group: "Gestão",
      meta: 1,
    },
    {
      id: "fed_first_event",
      entity: "Federacao",
      title: "Primeiro Evento",
      description: "Criou ou participou da organização do primeiro evento.",
      icon: "🏟️",
      tier: "bronze",
      group: "Eventos",
      meta: 1,
    },
    {
      id: "fed_5_events",
      entity: "Federacao",
      title: "Calendário Ativo",
      description: "Criou ou participou da organização de 5 eventos.",
      icon: "📅",
      tier: "prata",
      group: "Eventos",
      meta: 5,
    },
    {
      id: "fed_content_1",
      entity: "Federacao",
      title: "Primeiro Conteúdo",
      description: "Criou o primeiro conteúdo, curso ou metodologia no Learning.",
      icon: "🎓",
      tier: "bronze",
      group: "Learning",
      meta: 1,
    },
    {
      id: "fed_content_5",
      entity: "Federacao",
      title: "Federação Educadora",
      description: "Criou 5 conteúdos, cursos ou metodologias no Learning.",
      icon: "📚",
      tier: "prata",
      group: "Learning",
      meta: 5,
    },
  ];

  const uniqueByCodigo = new Map<string, OldAchievement>();
  for (const a of achievements) uniqueByCodigo.set(a.id, a);
  const finalList = Array.from(uniqueByCodigo.values());

  let criadas = 0;
  let ignoradas = 0;

  for (const a of finalList) {
    const metaFinal = a.meta ?? inferMetaFromCodigo(a.id);

    const existente = await prisma.conquista.findUnique({
      where: { codigo: a.id },
      select: { id: true },
    });

    if (existente) {
      ignoradas++;
      continue;
    }

    await prisma.conquista.create({
      data: {
        codigo: a.id,
        titulo: a.title,
        descricao: buildDescricao(a.description, a.group, a.tier),
        tipo: mapConquistaTipo(a.group),
        publico: [mapOwnerTipo(a.entity)],
        icon: a.icon ?? null,
        meta: metaFinal ?? null,
        ativo: true,
      },
    });

    criadas++;
  }

  console.log(
    `✅ Seed concluído. Criadas: ${criadas}. Já existiam: ${ignoradas}. Total na lista: ${finalList.length}`
  );
}

async function main() {
  await seedConquistasCatalog();
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });