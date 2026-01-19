import { Request, Response } from "express";
import {
  
  TipoUsuario,
  ConquistaOwnerTipo,
  TipoMidia,
} from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

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

function ownerTipoFromTipoUsuario(tipo: TipoUsuario): ConquistaOwnerTipo | null {
  if (tipo === TipoUsuario.Atleta) return ConquistaOwnerTipo.Atleta;
  if (tipo === TipoUsuario.Professor) return ConquistaOwnerTipo.Professor;
  if (tipo === TipoUsuario.Escolinha) return ConquistaOwnerTipo.Escolinha;
  if (tipo === TipoUsuario.Clube) return ConquistaOwnerTipo.Clube;
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
        // treino ligado direto ao clube
        { clubeId: ownerId },

        // treino cujo professor (campo Professor) pertence ao clube
        { Professor: { is: { clubeId: ownerId } } },

        // treino cujo criadorProfessor pertence ao clube
        { criadorProfessor: { is: { clubeId: ownerId } } },
      ],
    };
  }

  if (ownerTipo === ConquistaOwnerTipo.Escolinha) {
    return {
      OR: [
        // treino ligado direto à escolinha
        { escolinhaId: ownerId },

        // treino cujo professor (campo Professor) pertence à escolinha
        { Professor: { is: { escolinhaId: ownerId } } },

        // treino cujo criadorProfessor pertence à escolinha
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

  // =========================
  // CONTADORES (ZERADOS)
  // =========================
  let treinosConcluidos = 0;          // Atleta
  let submissoesTreinoTotal = 0;      // Atleta
  let pontosTotal = 0;                // Atleta
  let pontosPerformance = 0;          // Atleta
  let pontosDisciplina = 0;           // Atleta
  let pontosResponsabilidade = 0;     // Atleta

  let desafiosConcluidos = 0;         // Atleta (se existir no schema)
  let desafiosGrupoConcluidos = 0;    // Atleta (se existir)
  let treinosCriados = 0;             // Prof/Clube/Escolinha
  let eventosCriados = 0;             // Clube/Escolinha
  let atletasVinculados = 0;          // Prof/Clube/Escolinha

  let submissoesRecebidas = 0;        // Prof/Clube/Escolinha (fallback)
  let desafiosGrupoCriados = 0;       // Prof/Clube/Escolinha (fallback)
  let desafiosAprovadosDoGrupo = 0;   // Prof/Clube/Escolinha (fallback)

  let lastTreinoId: string | null = null;
  let lastEventoId: string | null = null;

  // =========================
  // ATLETA
  // =========================
  if (ownerTipo === ConquistaOwnerTipo.Atleta) {
    submissoesTreinoTotal = await prisma.submissaoTreino.count({
      where: { atletaId: ownerId },
    });
    treinosConcluidos = submissoesTreinoTotal;

    // Se existir submissaoDesafio no teu schema, conta também:
    try {
      desafiosConcluidos = await prismaAny.submissaoDesafio.count({
        where: { atletaId: ownerId },
      });
    } catch {
      desafiosConcluidos = 0;
    }
    // Se tiver "grupo", você ajusta depois com a regra real:
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

  // =========================
  // PROFESSOR / CLUBE / ESCOLINHA
  // =========================
  if (
    ownerTipo === ConquistaOwnerTipo.Professor ||
    ownerTipo === ConquistaOwnerTipo.Clube ||
    ownerTipo === ConquistaOwnerTipo.Escolinha
  ) {
    const whereTreinos = whereTreinosCriados(ownerTipo, ownerId);

    // Treinos criados
    treinosCriados = await prismaAny.treinoProgramado.count({
      where: whereTreinos,
    });

    const lastTreino = await prismaAny.treinoProgramado.findFirst({
      where: whereTreinos,
      select: { id: true },
      orderBy: { createdAt: "desc" }, // campo padrão mais provável
    });
    lastTreinoId = lastTreino?.id ?? null;

    // Atletas vinculados
    atletasVinculados = await prismaAny.relacaoTreinamento.count({
      where: whereAtletasVinculados(ownerTipo, ownerId),
    });

    // Eventos criados (só clube/escolinha)
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

    // (opcional) submissões recebidas: se teu schema permitir navegar pelo treinoProgramado
    // deixa fallback 0 sem quebrar o TS
    try {
      submissoesRecebidas = await prismaAny.submissaoTreino.count({
        where: {
          treinoAgendado: {
            is: {
              treinoProgramado: {
                is: whereTreinos, // pode precisar ajustar dependendo do teu schema
              },
            },
          },
        },
      });
    } catch {
      submissoesRecebidas = 0;
    }
  }

  // =========================
  // CATÁLOGO
  // =========================
  const catalogo = await prisma.conquista.findMany({
    where: { ativo: true, publico: { has: ownerTipo } },
    select: { id: true, codigo: true, tipo: true, meta: true },
    orderBy: { createdAt: "asc" },
  });

  // =========================
  // UPSERT
  // =========================
  for (const c of catalogo) {
    const codigo = String(c.codigo || "");
    const meta = c.meta == null ? null : Number(c.meta);
    if (meta == null || meta <= 0) continue;

    let atual = 0;
    let refTipo: string | null = null;
    let refId: string | null = null;

    // ATLETA
    if (codigo.startsWith("ath_train_")) atual = treinosConcluidos;
    else if (codigo === "ath_first_submit") atual = submissoesTreinoTotal;
    else if (codigo.startsWith("ath_chal_")) atual = desafiosConcluidos;
    else if (codigo.startsWith("ath_grp_")) atual = desafiosGrupoConcluidos;
    else if (codigo.startsWith("ath_pts_total_")) atual = pontosTotal;
    else if (codigo.startsWith("ath_pts_perf_")) atual = pontosPerformance;
    else if (codigo.startsWith("ath_pts_disc_")) atual = pontosDisciplina;
    else if (codigo.startsWith("ath_pts_resp_")) atual = pontosResponsabilidade;

    // PROFESSOR
    else if (codigo.startsWith("prof_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("prof_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("prof_subs_")) atual = submissoesRecebidas;
    else if (codigo.startsWith("prof_grp_")) atual = desafiosGrupoCriados;

    // ESCOLINHA
    else if (codigo.startsWith("esc_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("esc_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("esc_subs_")) atual = submissoesRecebidas;
    else if (codigo.startsWith("esc_desafios_aprov_")) atual = desafiosAprovadosDoGrupo;

    // CLUBE
    else if (codigo.startsWith("clu_tp_")) atual = treinosCriados;
    else if (codigo.startsWith("clu_atletas_")) atual = atletasVinculados;
    else if (codigo.startsWith("clu_evento_")) atual = eventosCriados;

    // fallback por tipo (mantive tua ideia)
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

    // ref p/ evento
    if (!refTipo && /evt_/i.test(codigo)) {
      refTipo = "Evento";
      refId = lastEventoId;
    }

    const concluida = atual >= meta;
    const progresso = Math.min(100, Math.floor((atual / meta) * 100));

    const ownerFkData =
      ownerTipo === ConquistaOwnerTipo.Atleta
        ? { atletaId: ownerId, professorId: null, clubeId: null, escolinhaId: null }
        : ownerTipo === ConquistaOwnerTipo.Professor
        ? { atletaId: null, professorId: ownerId, clubeId: null, escolinhaId: null }
        : ownerTipo === ConquistaOwnerTipo.Clube
        ? { atletaId: null, professorId: null, clubeId: ownerId, escolinhaId: null }
        : { atletaId: null, professorId: null, clubeId: null, escolinhaId: ownerId };

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

export async function getConquistasCount(req: AuthenticatedRequest, res: Response) {
  try {
    const ownerTipo = String(req.query.ownerTipo || "").trim(); // "Escolinha"
    const ownerId = String(req.query.ownerId || "").trim();     // id da escolinha

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
      return res.status(400).json({ error: "entity inválida. Use atleta|professor|escolinha|clube" });
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

export const __prisma = prisma;