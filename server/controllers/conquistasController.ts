// server/controller/conquistascontroller.tsx
import { Request, Response } from "express";
import {  
  TipoUsuario,
  ConquistaOwnerTipo,
  TipoMidia,
} from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import { syncConquistasMetodologias, syncTemplatesMetodologiasProfissionais } from "../services/conquistasMetodologia.js";

const prismaAny = prisma as any;

type AuthReq = Request & { userId?: string };
type ConquistaDTO = {
  id: string;
  codigo: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  icon?: string | null;
  iconUrl?: string | null;
  pontos?: number | null;
  meta?: number | null;
  ativo: boolean;
  publico: ConquistaOwnerTipo[];
};

type EarnedDTO = {
  vinculoId: string;
  conquista: ConquistaDTO;
  conquistadoEm?: Date | null;
  progresso: number;
  concluida: boolean;
  refTipo?: string | null;
  refId?: string | null;
};

type CertificadoDTO = {
  id: string;
  metodologiaId: string;
  tituloMetodologia: string;
  nomeUsuario: string;
  nomeEmissor: string;
  codigoValidacao: string;
  emitidoEm: Date | null;
  concluidoEm: Date | null;
  imagemUrl?: string | null;
  pdfUrl?: string | null;
};

function ownerTipoFromTipoUsuario(tipo: TipoUsuario): ConquistaOwnerTipo | null {
  if (tipo === TipoUsuario.Atleta) return ConquistaOwnerTipo.Atleta;
  if (tipo === TipoUsuario.Professor) return ConquistaOwnerTipo.Professor;
  if (tipo === TipoUsuario.Escolinha) return ConquistaOwnerTipo.Escolinha;
  if (tipo === TipoUsuario.Clube) return ConquistaOwnerTipo.Clube;
  if (tipo === TipoUsuario.Learning) return ConquistaOwnerTipo.Learning;
  if (tipo === TipoUsuario.Marca) return ConquistaOwnerTipo.Marca;
  if (tipo === TipoUsuario.Federacao) return ConquistaOwnerTipo.Federacao;
  return null;
}

async function resolveOwnerIdByUsuarioId(
  usuarioId: string,
  tipo: TipoUsuario
): Promise<string | null> {
  if (tipo === TipoUsuario.Atleta) {
    const at = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return at?.id ?? null;
  }

  if (tipo === TipoUsuario.Professor) {
    const prof = await prisma.professor.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    return prof?.id ?? null;
  }

  if (tipo === TipoUsuario.Clube) {
    const clu = await prisma.clube.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return clu?.id ?? null;
  }

  if (tipo === TipoUsuario.Escolinha) {
    const esc = await prisma.escolinha.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    return esc?.id ?? null;
  }

  if (tipo === TipoUsuario.Learning) {
    const learning = await prisma.learningProfile.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return learning?.id ?? null;
  }

  if (tipo === TipoUsuario.Marca) {
    const marca = await prisma.marca.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return marca?.id ?? null;
  }

  if (tipo === TipoUsuario.Federacao) {
    const federacao = await prisma.federacao.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return federacao?.id ?? null;
  }

  return null;
}

function toConquistaDTO(c: any): ConquistaDTO {
  return {
    id: c.id,
    codigo: c.codigo,
    titulo: c.titulo,
    descricao: c.descricao ?? null,
    tipo: String(c.tipo),
    icon: c.icon ?? null,
    iconUrl: c.iconUrl ?? null,
    pontos: c.pontos ?? null,
    meta: c.meta ?? null,
    ativo: Boolean(c.ativo),
    publico: (c.publico ?? []) as ConquistaOwnerTipo[],
  };
}

function whereTreinosCriados(ownerTipo: ConquistaOwnerTipo, ownerId: string) {
  if (ownerTipo === ConquistaOwnerTipo.Professor) {
    return {
      OR: [{ professorId: ownerId }, { criadorProfessorId: ownerId }],
    };
  }

  if (ownerTipo === ConquistaOwnerTipo.Clube) {
    return {
      OR: [
        { clubeId: ownerId },
        { Professor: { is: { clubeId: ownerId } } },
        { criadorProfessor: { is: { clubeId: ownerId } } },
      ],
    };
  }

  if (ownerTipo === ConquistaOwnerTipo.Escolinha) {
    return {
      OR: [
        { escolinhaId: ownerId },
        { Professor: { is: { escolinhaId: ownerId } } },
        { criadorProfessor: { is: { escolinhaId: ownerId } } },
      ],
    };
  }

  return {};
}

function whereAtletasVinculados(ownerTipo: ConquistaOwnerTipo, ownerId: string) {
  if (ownerTipo === ConquistaOwnerTipo.Professor) return { professorId: ownerId, ativo: true };
  if (ownerTipo === ConquistaOwnerTipo.Clube) return { clubeId: ownerId, ativo: true };
  if (ownerTipo === ConquistaOwnerTipo.Escolinha) return { escolinhaId: ownerId, ativo: true };
  return {};
}

async function syncTemplatesMetodologiasComBadge() {
  const publicoTodos = [
    ConquistaOwnerTipo.Atleta,
    ConquistaOwnerTipo.Professor,
    ConquistaOwnerTipo.Escolinha,
    ConquistaOwnerTipo.Clube,
    ConquistaOwnerTipo.Learning,
    ConquistaOwnerTipo.Marca,
    ConquistaOwnerTipo.Federacao,
  ];

  const [learning, avulsas] = await Promise.all([
    prisma.metodologia.findMany({
      where: { geraBadge: true },
      select: { id: true, titulo: true, descricao: true, ativo: true },
    }),
    prisma.metodologiaAvulsa.findMany({
      where: { geraBadge: true },
      select: { id: true, titulo: true, descricao: true, ativo: true },
    }),
  ]);

  for (const m of learning) {
    await prisma.conquista.upsert({
      where: { codigo: `metodologia_learning_${m.id}` },
      update: {
        titulo: `Metodologia: ${m.titulo}`,
        descricao: m.descricao || "Conclua esta metodologia para desbloquear esta conquista.",
        tipo: "METODOLOGIA" as any,
        icon: "🎓",
        ativo: true,
        publico: publicoTodos,
      },
      create: {
        codigo: `metodologia_learning_${m.id}`,
        titulo: `Metodologia: ${m.titulo}`,
        descricao: m.descricao || "Conclua esta metodologia para desbloquear esta conquista.",
        tipo: "METODOLOGIA" as any,
        icon: "🎓",
        pontos: 0,
        meta: 1,
        ativo: true,
        publico: publicoTodos,
      },
    });
  }

  for (const m of avulsas) {
    await prisma.conquista.upsert({
      where: { codigo: `metodologia_avulsa_${m.id}` },
      update: {
        titulo: `Metodologia: ${m.titulo}`,
        descricao: m.descricao || "Conclua esta metodologia para desbloquear esta conquista.",
        tipo: "METODOLOGIA" as any,
        icon: "🎓",
        ativo: true,
        publico: publicoTodos,
      },
      create: {
        codigo: `metodologia_avulsa_${m.id}`,
        titulo: `Metodologia: ${m.titulo}`,
        descricao: m.descricao || "Conclua esta metodologia para desbloquear esta conquista.",
        tipo: "METODOLOGIA" as any,
        icon: "🎓",
        pontos: 0,
        meta: 1,
        ativo: true,
        publico: publicoTodos,
      },
    });
  }
}

export async function syncConquistasDoUsuario(usuarioId: string) {
  const user = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });
  if (!user) return;

  const ownerTipo = ownerTipoFromTipoUsuario(user.tipo);
  if (!ownerTipo) return;

  const ownerId = await resolveOwnerIdByUsuarioId(usuarioId, user.tipo);
  if (!ownerId) return;

  let treinosConcluidos = 0;          
  let submissoesTreinoTotal = 0;      
  let pontosTotal = 0;                
  let pontosPerformance = 0;          
  let pontosDisciplina = 0;           
  let pontosResponsabilidade = 0;     
  let desafiosConcluidos = 0;         
  let desafiosGrupoConcluidos = 0;     
  let treinosCriados = 0;             
  let eventosCriados = 0;             
  let atletasVinculados = 0;          
  let submissoesRecebidas = 0;         
  let desafiosGrupoCriados = 0;      
  let desafiosAprovadosDoGrupo = 0;    
  let conteudosLearningCriados = 0;
  let perfilInstitucionalCompleto = 0;
  let lastTreinoId: string | null = null;
  let lastEventoId: string | null = null;

  if (ownerTipo === ConquistaOwnerTipo.Atleta) {
    submissoesTreinoTotal = await prisma.submissaoTreino.count({
      where: { atletaId: ownerId },
    });
    treinosConcluidos = submissoesTreinoTotal;

    try {
      desafiosConcluidos = await prismaAny.submissaoDesafio.count({
        where: { atletaId: ownerId },
      });
    } catch {
      desafiosConcluidos = 0;
    }
    desafiosGrupoConcluidos = 0;

    const pontosAgg = await prisma.pontuacaoAtleta.aggregate({
      where: { atletaId: ownerId },
      _sum: {
        pontuacaoPerformance: true,
        pontuacaoDisciplina: true,
        pontuacaoResponsabilidade: true,
      },
    });

    pontosPerformance = Number(pontosAgg._sum.pontuacaoPerformance ?? 0);
    pontosDisciplina = Number(pontosAgg._sum.pontuacaoDisciplina ?? 0);
    pontosResponsabilidade = Number(pontosAgg._sum.pontuacaoResponsabilidade ?? 0);
    pontosTotal = pontosPerformance + pontosDisciplina + pontosResponsabilidade;
  }

  if (
    ownerTipo === ConquistaOwnerTipo.Professor ||
    ownerTipo === ConquistaOwnerTipo.Clube ||
    ownerTipo === ConquistaOwnerTipo.Escolinha
  ) {
    const whereTreinos = whereTreinosCriados(ownerTipo, ownerId);

    treinosCriados = await prismaAny.treinoProgramado.count({
      where: whereTreinos,
    });

    const lastTreino = await prismaAny.treinoProgramado.findFirst({
      where: whereTreinos,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    lastTreinoId = lastTreino?.id ?? null;
    atletasVinculados = await prismaAny.relacaoTreinamento.count({
      where: whereAtletasVinculados(ownerTipo, ownerId),
    });

    if (ownerTipo === ConquistaOwnerTipo.Clube) {
      eventosCriados = await prismaAny.evento.count({ where: { clubeId: ownerId } });
      const lastEvt = await prismaAny.evento.findFirst({
        where: { clubeId: ownerId },
        select: { id: true },
        orderBy: { criadoEm: "desc" },
      });
      lastEventoId = lastEvt?.id ?? null;
    }

    if (ownerTipo === ConquistaOwnerTipo.Escolinha) {
      eventosCriados = await prismaAny.evento.count({ where: { escolinhaId: ownerId } });
      const lastEvt = await prismaAny.evento.findFirst({
        where: { escolinhaId: ownerId },
        select: { id: true },
        orderBy: { criadoEm: "desc" },
      });
      lastEventoId = lastEvt?.id ?? null;
    }

    try {
      submissoesRecebidas = await prismaAny.submissaoTreino.count({
        where: {
          treinoAgendado: {
            is: {
              treinoProgramado: {
                is: whereTreinos, 
              },
            },
          },
        },
      });
    } catch {
      submissoesRecebidas = 0;
    }
  }

  if (
    ownerTipo === ConquistaOwnerTipo.Marca ||
    ownerTipo === ConquistaOwnerTipo.Federacao
  ) {
    const [metodologiasCriadas, metodologiasAvulsasCriadas] = await Promise.all([
      prismaAny.metodologia.count({
        where: {
          criadorUsuarioId: usuarioId,
        },
      }),
      prismaAny.metodologiaAvulsa.count({
        where: {
          criadorUsuarioId: usuarioId,
        },
      }),
    ]);

    conteudosLearningCriados =
      Number(metodologiasCriadas || 0) + Number(metodologiasAvulsasCriadas || 0);

    if (ownerTipo === ConquistaOwnerTipo.Marca) {
      const marca = await prismaAny.marca.findUnique({
        where: { id: ownerId },
        select: {
          id: true,
          nome: true,
          email: true,
          cnpj: true,
          siteOficial: true,
          cidade: true,
          estado: true,
          descricao: true,
        },
      });

      perfilInstitucionalCompleto =
        marca?.nome &&
        marca?.email &&
        marca?.cidade &&
        marca?.estado &&
        marca?.descricao
          ? 1
          : 0;

      try {
        eventosCriados = await prismaAny.evento.count({
          where: { marcaId: ownerId },
        });

        const lastEvt = await prismaAny.evento.findFirst({
          where: { marcaId: ownerId },
          select: { id: true },
          orderBy: { criadoEm: "desc" },
        });

        lastEventoId = lastEvt?.id ?? null;
      } catch {
        eventosCriados = 0;
      }
    }

    if (ownerTipo === ConquistaOwnerTipo.Federacao) {
      const federacao = await prismaAny.federacao.findUnique({
        where: { id: ownerId },
        select: {
          id: true,
          nome: true,
          email: true,
          cnpj: true,
          siteOficial: true,
          cidade: true,
          estado: true,
          descricao: true,
        },
      });

      perfilInstitucionalCompleto =
        federacao?.nome &&
        federacao?.email &&
        federacao?.cidade &&
        federacao?.estado &&
        federacao?.descricao
          ? 1
          : 0;

      try {
        eventosCriados = await prismaAny.evento.count({
          where: { federacaoId: ownerId },
        });

        const lastEvt = await prismaAny.evento.findFirst({
          where: { federacaoId: ownerId },
          select: { id: true },
          orderBy: { criadoEm: "desc" },
        });

        lastEventoId = lastEvt?.id ?? null;
      } catch {
        eventosCriados = 0;
      }
    }
  }

  try {
    await syncTemplatesMetodologiasProfissionais();
  } catch (e) {
    console.error("Falha ao syncTemplatesMetodologiasProfissionais:", e);
  }

  const catalogo = await prisma.conquista.findMany({
    where: { ativo: true, publico: { has: ownerTipo } },
    select: { id: true, codigo: true, tipo: true, meta: true },
    orderBy: { createdAt: "asc" },
  });

  try {
    await syncConquistasMetodologias(usuarioId);
  } catch (e) {
    console.error("Falha ao syncConquistasMetodologias:", e);
  }

  for (const c of catalogo) {
    const tipo = String(c.tipo || "").toUpperCase();
    const codigo = String(c.codigo || "");

    if (tipo === "METODOLOGIA" || codigo.startsWith("metodologia_")) {
      const isAvulsa = codigo.startsWith("metodologia_avulsa_");
      const isMetodologiaNormal =
        codigo.startsWith("metodologia_") &&
        !codigo.startsWith("metodologia_avulsa_") &&
        !codigo.startsWith("metodologia_learning_");
      const refId = codigo
        .replace(/^metodologia_avulsa_/, "")
        .replace(/^metodologia_learning_/, "")
        .replace(/^metodologia_/, "");

      const assinaturaConcluida = await prisma.metodologiaAssinante.findFirst({
        where: {
          usuarioId,
          ...(isAvulsa
            ? { metodologiaAvulsaId: refId }
            : { metodologiaId: refId }),
          OR: [
            { status: "CONCLUIDA" as any },
            { concluiuEm: { not: null } },
          ],
        },
        select: { id: true, concluiuEm: true },
      });

      const concluida = !!assinaturaConcluida;
      const ownerFkData = {
        atletaId: ownerTipo === ConquistaOwnerTipo.Atleta ? ownerId : null,
        professorId: ownerTipo === ConquistaOwnerTipo.Professor ? ownerId : null,
        clubeId: ownerTipo === ConquistaOwnerTipo.Clube ? ownerId : null,
        escolinhaId: ownerTipo === ConquistaOwnerTipo.Escolinha ? ownerId : null,
        learningProfileId: ownerTipo === ConquistaOwnerTipo.Learning ? ownerId : null,
        marcaId: ownerTipo === ConquistaOwnerTipo.Marca ? ownerId : null,
        federacaoId: ownerTipo === ConquistaOwnerTipo.Federacao ? ownerId : null,
      };

      const existing = await prisma.conquistaVinculo.findUnique({
        where: {
          ownerTipo_ownerId_conquistaId: { ownerTipo, ownerId, conquistaId: c.id },
        },
        select: { concluida: true },
      });

      await prisma.conquistaVinculo.upsert({
        where: {
          ownerTipo_ownerId_conquistaId: { ownerTipo, ownerId, conquistaId: c.id },
        },
        create: {
          ownerTipo,
          ownerId,
          conquistaId: c.id,
          ...ownerFkData,
          progresso: concluida ? 100 : 0,
          concluida,
          conquistadoEm: concluida
            ? assinaturaConcluida?.concluiuEm ?? new Date()
            : null,
          refTipo: concluida ? (isAvulsa ? "MetodologiaAvulsa" : "Metodologia") : null,
          refId: concluida ? refId : null,
        },
        update: {
          ...ownerFkData,
          progresso: concluida ? 100 : 0,
          concluida,
          ...(concluida && !existing?.concluida
            ? { conquistadoEm: assinaturaConcluida?.concluiuEm ?? new Date() }
            : {}),
          refTipo: concluida ? (isAvulsa ? "MetodologiaAvulsa" : "Metodologia") : null,
          refId: concluida ? refId : null,
        },
      });

      continue;
    }

    const meta = c.meta == null ? null : Number(c.meta);
    if (meta == null || meta <= 0) continue;

    let atual = 0;
    let refTipo: string | null = null;
    let refId: string | null = null;
  
    if (codigo.startsWith("ath_train_")) atual = treinosConcluidos;
    else if (codigo === "ath_first_submit") atual = submissoesTreinoTotal;
    else if (codigo.startsWith("ath_chal_")) atual = desafiosConcluidos;
    else if (codigo.startsWith("ath_grp_")) atual = desafiosGrupoConcluidos;
    else if (codigo.startsWith("ath_pts_total_")) atual = pontosTotal;
    else if (codigo.startsWith("ath_pts_perf_")) atual = pontosPerformance;
    else if (codigo.startsWith("ath_pts_disc_")) atual = pontosDisciplina;
    else if (codigo.startsWith("ath_pts_resp_")) atual = pontosResponsabilidade;
    else if (codigo.startsWith("prof_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("prof_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("prof_subs_")) atual = submissoesRecebidas;
    else if (codigo.startsWith("prof_grp_")) atual = desafiosGrupoCriados;
    else if (codigo.startsWith("esc_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("esc_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("esc_subs_")) atual = submissoesRecebidas;
    else if (codigo.startsWith("esc_desafios_aprov_")) atual = desafiosAprovadosDoGrupo;
    else if (codigo.startsWith("clu_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("clu_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("clu_evento_")) atual = eventosCriados;
    else if (codigo === "brand_profile_complete" || codigo === "fed_profile_complete") {
      atual = perfilInstitucionalCompleto;
      refTipo =
        ownerTipo === ConquistaOwnerTipo.Marca
          ? "Marca"
          : ownerTipo === ConquistaOwnerTipo.Federacao
          ? "Federacao"
          : null;
      refId = ownerId;
    }
    else if (
      codigo === "brand_first_event" ||
      codigo === "brand_5_events" ||
      codigo === "fed_first_event" ||
      codigo === "fed_5_events"
    ) {
      atual = eventosCriados;
      refTipo = "Evento";
      refId = lastEventoId;
    }
    else if (
      codigo === "brand_first_content" ||
      codigo === "brand_5_contents" ||
      codigo.startsWith("brand_content_")
    ) {
      atual = conteudosLearningCriados;
      refTipo = "LearningConteudo";
      refId = null;
    }
    else if (codigo.startsWith("fed_content_")) {
      atual = conteudosLearningCriados;
      refTipo = "LearningConteudo";
      refId = null;
    }
    else {
      switch (String(c.tipo).toUpperCase()) {
        case "TREINO":
          atual =
            ownerTipo === ConquistaOwnerTipo.Atleta ? treinosConcluidos : treinosCriados;
          refTipo =
            ownerTipo === ConquistaOwnerTipo.Atleta
              ? "SubmissaoTreino"
              : "TreinoProgramado";
          refId = ownerTipo === ConquistaOwnerTipo.Atleta ? null : lastTreinoId;
          break;

        case "ORGANIZACAO":
          atual = atletasVinculados;
          refTipo = "RelacaoTreinamento";
          refId = null;
          break;

        case "PERFIL":
          atual = pontosTotal;
          refTipo = "PontuacaoAtleta";
          refId = null;
          break;

        default:
          atual =
            ownerTipo === ConquistaOwnerTipo.Atleta
              ? submissoesTreinoTotal
              : treinosCriados;
          break;
      }
    }

    if (!refTipo && /evt_/i.test(codigo)) {
      refTipo = "Evento";
      refId = lastEventoId;
    }

    const concluida = atual >= meta;
    const progresso = Math.min(100, Math.floor((atual / meta) * 100));

    const ownerFkData = {
      atletaId: ownerTipo === ConquistaOwnerTipo.Atleta ? ownerId : null,
      professorId: ownerTipo === ConquistaOwnerTipo.Professor ? ownerId : null,
      clubeId: ownerTipo === ConquistaOwnerTipo.Clube ? ownerId : null,
      escolinhaId: ownerTipo === ConquistaOwnerTipo.Escolinha ? ownerId : null,
      learningProfileId: ownerTipo === ConquistaOwnerTipo.Learning ? ownerId : null,
      marcaId: ownerTipo === ConquistaOwnerTipo.Marca ? ownerId : null,
      federacaoId: ownerTipo === ConquistaOwnerTipo.Federacao ? ownerId : null,
    };

    const existing = await prisma.conquistaVinculo.findUnique({
      where: {
        ownerTipo_ownerId_conquistaId: { ownerTipo, ownerId, conquistaId: c.id },
      },
      select: { concluida: true, conquistadoEm: true },
    });

    const shouldSetConquistadoEm = concluida && !existing?.concluida;

    await prisma.conquistaVinculo.upsert({
      where: {
        ownerTipo_ownerId_conquistaId: { ownerTipo, ownerId, conquistaId: c.id },
      },
      create: {
        ownerTipo,
        ownerId,
        conquistaId: c.id,
        progresso,
        concluida,
        conquistadoEm: concluida ? new Date() : null,
        refTipo: concluida ? refTipo : null,
        refId: concluida ? refId : null,
        ...ownerFkData,
      },
      update: {
        progresso,
        concluida,
        ...(shouldSetConquistadoEm ? { conquistadoEm: new Date() } : {}),
        ...(concluida
          ? { refTipo: refTipo ?? undefined, refId: refId ?? undefined }
          : { refTipo: null, refId: null }),
        ...ownerFkData,
      },
    });
  }
}

export async function getEarnedByUsuarioId(req: AuthReq, res: Response) {
  try {
    const usuarioIdParam = (req.params as any)?.usuarioId as string | undefined;
    const usuarioId = String(usuarioIdParam || req.userId || "").trim();
    if (!usuarioId) return res.status(401).json({ error: "Sem autenticação." });

    const user = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const tipoOverride = String((req.query as any)?.tipo ?? "").trim();
    const tipoFinal =
      tipoOverride &&
      (Object.values(TipoUsuario) as string[]).includes(tipoOverride)
        ? (tipoOverride as TipoUsuario)
        : user.tipo;

    const sync = String((req.query as any)?.sync || "1") !== "0";
    if (sync) await syncConquistasDoUsuario(usuarioId);

    const ownerTipo = ownerTipoFromTipoUsuario(tipoFinal);
    const ownerIdResolved = await resolveOwnerIdByUsuarioId(usuarioId, tipoFinal);
    if (!ownerTipo) {
      return res.json({ usuarioId, ownerTipo: null, totalAvailable: 0, earned: [] as EarnedDTO[] });
    }

    const totalAvailable = await prisma.conquista.count({
      where: { ativo: true, publico: { has: ownerTipo } },
    });

    if (!ownerIdResolved) {
      return res.json({ usuarioId, ownerTipo, totalAvailable, earned: [] });
    }

    const onlyConcluidas =
      String((req.query as any)?.onlyConcluidas ?? "0") === "1" ||
      String((req.query as any)?.onlyConcluidas ?? "").toLowerCase() === "true";

    const vinculos = await prisma.conquistaVinculo.findMany({
      where: {
        ownerTipo,
        ownerId: ownerIdResolved,
        ...(onlyConcluidas ? { concluida: true } : {}),
      },
      include: { conquista: true },
      orderBy: [{ concluida: "desc" }, { conquistadoEm: "desc" }, { createdAt: "desc" }],
    });

    const earned: EarnedDTO[] = vinculos.map((v) => ({
      vinculoId: v.id,
      conquista: toConquistaDTO(v.conquista),
      conquistadoEm: v.conquistadoEm,
      progresso: v.progresso ?? 0,
      concluida: Boolean(v.concluida),
      refTipo: v.refTipo ?? null,
      refId: v.refId ?? null,
    }));

    return res.json({ usuarioId, ownerTipo, totalAvailable, earned });
  } catch (e: any) {
    console.error("getEarnedByUsuarioId error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao obter conquistas do usuário" });
  }
}

export async function getCertificadosByUsuarioId(req: AuthReq, res: Response) {
  try {
    const usuarioIdParam = String((req.params as any)?.usuarioId || "").trim();
    const usuarioIdQuery = String((req.query as any)?.usuarioId || "").trim();
    const usuarioId = usuarioIdParam || usuarioIdQuery || String(req.userId || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ error: "Sem autenticação." });
    }

    const user = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const rows = await prismaAny.certificadoMetodologia.findMany({
      where: { usuarioId },
      orderBy: [{ emitidoEm: "desc" }],
      select: {
        id: true,
        metodologiaId: true,
        tituloMetodologia: true,
        nomeUsuario: true,
        nomeEmissor: true,
        codigoValidacao: true,
        emitidoEm: true,
        concluidoEm: true,
        imagemUrl: true,
        pdfUrl: true,
      },
    });

    const items: CertificadoDTO[] = rows.map((r: any) => ({
      id: String(r.id),
      metodologiaId: String(r.metodologiaId),
      tituloMetodologia: String(r.tituloMetodologia ?? ""),
      nomeUsuario: String(r.nomeUsuario ?? ""),
      nomeEmissor: String(r.nomeEmissor ?? ""),
      codigoValidacao: String(r.codigoValidacao ?? ""),
      emitidoEm: r.emitidoEm ?? null,
      concluidoEm: r.concluidoEm ?? null,
      imagemUrl: r.imagemUrl ?? null,
      pdfUrl: r.pdfUrl ?? null,
    }));

    return res.json({
      usuarioId,
      total: items.length,
      items,
    });
  } catch (e: any) {
    console.error("getCertificadosByUsuarioId error:", e);
    return res.status(500).json({
      error: e?.message || "Erro ao obter certificados do usuário",
    });
  }
}

export async function getCertificadosCount(req: AuthReq, res: Response) {
  try {
    const usuarioIdParam = String((req.params as any)?.usuarioId || "").trim();
    const usuarioIdQuery = String((req.query as any)?.usuarioId || "").trim();
    const usuarioId = usuarioIdParam || usuarioIdQuery || String(req.userId || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ error: "Sem autenticação." });
    }

    const count = await prismaAny.certificadoMetodologia.count({
      where: { usuarioId },
    });

    return res.json({ usuarioId, count });
  } catch (e: any) {
    console.error("getCertificadosCount error:", e);
    return res.status(500).json({
      error: e?.message || "Erro ao contar certificados",
    });
  }
}

export async function getConquistasCount(req: AuthenticatedRequest, res: Response) {
  try {
    const ownerTipo = String(req.query.ownerTipo || "").trim();
    const ownerId = String(req.query.ownerId || "").trim();   

    if (!ownerTipo || !ownerId) {
      return res.status(400).json({ message: "ownerTipo e ownerId são obrigatórios" });
    }

    const count = await prisma.conquistaVinculo.count({
      where: {
        ownerTipo: ownerTipo as any,
        ownerId,
        concluida: true,
      },
    });

    return res.json({ count });
  } catch (e) {
    console.error("getConquistasCount error:", e);
    return res.status(500).json({ message: "Erro ao contar conquistas" });
  }
}

export async function getCatalog(req: Request, res: Response) {
  try {
    const raw = (req.params.entity || req.query.entity || "")
      .toString()
      .toLowerCase()
      .trim();

    const map: Record<string, ConquistaOwnerTipo> = {
      atleta: ConquistaOwnerTipo.Atleta,
      professor: ConquistaOwnerTipo.Professor,
      escolinha: ConquistaOwnerTipo.Escolinha,
      clube: ConquistaOwnerTipo.Clube,
      learning: ConquistaOwnerTipo.Learning,
      marca: ConquistaOwnerTipo.Marca,
      federacao: ConquistaOwnerTipo.Federacao,
    };

    if (!raw) {
      const all = await prisma.conquista.findMany({
        where: { ativo: true },
        orderBy: { createdAt: "asc" },
      });
      const items = all.map(toConquistaDTO);
      return res.json({ total: items.length, items });
    }

    const ownerTipo = map[raw];
    if (!ownerTipo) {
      return res.status(400).json({
        error: "entity inválida. Use atleta|professor|escolinha|clube|learning|marca|federacao",
      });
    }

    const list = await prisma.conquista.findMany({
      where: { ativo: true, publico: { has: ownerTipo } },
      orderBy: { createdAt: "asc" },
    });

    const items = list.map(toConquistaDTO);
    return res.json({ ownerTipo, total: items.length, items });
  } catch (e: any) {
    console.error("getCatalog error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao obter catálogo" });
  }
}

export async function compartilharConquista(req: AuthReq, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Sem autenticação." });

  const { conquistaId, codigo, mensagem } = req.body as {
    conquistaId?: string;
    codigo?: string;
    mensagem?: string;
  };

  if (!conquistaId && !codigo) {
    return res.status(400).json({ message: "Envie conquistaId ou codigo." });
  }

  const conquista = await prisma.conquista.findFirst({
    where: {
      ...(conquistaId ? { id: conquistaId } : {}),
      ...(codigo ? { codigo } : {}),
      ativo: true,
    },
  });

  if (!conquista) return res.status(404).json({ message: "Conquista não encontrada." });

  const iconTxt = conquista.icon ? ` ${conquista.icon}` : "";
  const conteudo =
    (mensagem?.trim() || `Conquista desbloqueada: ${conquista.titulo}!${iconTxt}`) ?? "";

  const imagemUrl = conquista.iconUrl ?? null;

  const post = await prisma.postagem.create({
    data: {
      usuarioId: userId,
      conteudo,
      imagemUrl,
      tipoMidia: imagemUrl ? TipoMidia.Imagem : null,
      dataCriacao: new Date(),
    },
  });

  return res.status(201).json({ ok: true, post });
}

export async function getAuditoria(req: Request, res: Response) {
  try {
    const conquistaId = String((req.query as any)?.conquistaId ?? "").trim();
    const usuarioId = String((req.query as any)?.usuarioId ?? "").trim();
    const ownerTipoRaw = String((req.query as any)?.ownerTipo ?? "").trim();

    const ownerTipo =
      ownerTipoRaw &&
      (Object.values(ConquistaOwnerTipo) as string[]).includes(ownerTipoRaw)
        ? (ownerTipoRaw as ConquistaOwnerTipo)
        : null;

    if (!conquistaId && !usuarioId) {
      return res.status(400).json({
        error:
          "Envie conquistaId ou usuarioId. Ex: /api/conquistas/auditoria?conquistaId=... ou ?usuarioId=...",
      });
    }

    let whereOwnerTipo: ConquistaOwnerTipo | null = ownerTipo;
    let whereOwnerId: string | null = null;

    if (usuarioId) {
      const user = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { tipo: true },
      });
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

      const tipoOwner = ownerTipoFromTipoUsuario(user.tipo);
      if (!tipoOwner) return res.status(400).json({ error: "Tipo de usuário sem ownerTipo compatível" });

      if (whereOwnerTipo && whereOwnerTipo !== tipoOwner) {
        return res.status(400).json({ error: `ownerTipo não bate com o tipo do usuário (${tipoOwner}).` });
      }

      whereOwnerTipo = tipoOwner;

      const ownerIdResolved = await resolveOwnerIdByUsuarioId(usuarioId, user.tipo);
      if (!ownerIdResolved) {
        return res.status(404).json({
          error: "Owner (Atleta/Professor/Clube/Escolinha) não encontrado para esse usuário",
        });
      }
      whereOwnerId = ownerIdResolved;
    }

    const where: any = {
      ...(conquistaId ? { conquistaId } : {}),
      ...(whereOwnerTipo ? { ownerTipo: whereOwnerTipo } : {}),
      ...(whereOwnerId ? { ownerId: whereOwnerId } : {}),
    };

    const rows = await prisma.conquistaVinculo.findMany({
      where,
      include: {
        conquista: true,
        atleta: { select: { id: true, nome: true, usuarioId: true } },
        professor: { select: { id: true, nome: true, usuarioId: true } },
        clube: { select: { id: true, nome: true, usuarioId: true } },
        escolinha: { select: { id: true, nome: true, usuarioId: true } },
      },
      orderBy: [{ concluida: "desc" }, { conquistadoEm: "desc" }, { createdAt: "desc" }],
    });

    const items = rows.map((v) => {
      const dono = v.atleta ?? v.professor ?? v.clube ?? v.escolinha ?? null;
      return {
        vinculoId: v.id,
        ownerTipo: v.ownerTipo,
        ownerId: v.ownerId,
        dono,
        conquistadoEm: v.conquistadoEm,
        progresso: v.progresso,
        concluida: v.concluida,
        conquista: {
          id: v.conquista.id,
          codigo: v.conquista.codigo,
          titulo: v.conquista.titulo,
          tipo: v.conquista.tipo,
          meta: v.conquista.meta,
        },
      };
    });

    return res.json({
      filtro: { conquistaId: conquistaId || null, usuarioId: usuarioId || null, ownerTipo: whereOwnerTipo },
      total: items.length,
      items,
    });
  } catch (e: any) {
    console.error("getAuditoria error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao auditar conquistas" });
  }
}

export async function syncAllUsuarios(req: Request, res: Response) {
  try {
    const tipoFiltro = String((req.query as any)?.tipo ?? "").trim();
    const users = await prisma.usuario.findMany({
      where: tipoFiltro ? ({ tipo: tipoFiltro as any } as any) : undefined,
      select: { id: true, tipo: true },
    });

    const result = {
      totalUsuarios: users.length,
      ok: 0,
      falhas: 0,
      detalhes: [] as Array<{ usuarioId: string; tipo: any; ok: boolean; erro?: string }>,
    };

    for (const u of users) {
      try {
        await syncConquistasDoUsuario(u.id);
        result.ok++;
        result.detalhes.push({ usuarioId: u.id, tipo: u.tipo, ok: true });
      } catch (e: any) {
        result.falhas++;
        result.detalhes.push({ usuarioId: u.id, tipo: u.tipo, ok: false, erro: e?.message || String(e) });
      }
    }

    return res.json(result);
  } catch (e: any) {
    console.error("syncAllUsuarios error:", e);
    return res.status(500).json({ error: e?.message || "Erro no syncAllUsuarios" });
  }
}

export async function getConquistaById(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ conquista: null });

    const conquista = await prisma.conquista.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        icon: true,
      },
    });

    return res.json({ conquista: conquista ?? null });
  } catch (e) {
    console.error("[getConquistaById]", e);
    return res.status(500).json({ conquista: null });
  }
}

export const __prisma = prisma;