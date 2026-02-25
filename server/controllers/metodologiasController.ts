// server/controllers/metodologiasController
import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { startOfMonth, addMonths, addYears } from "date-fns";
import {
  MetodologiaAssinaturaStatus,
  MetodologiaAssinaturaOrigem,
  MetodologiaPublicoAlvo,
  MetodologiaConteudoTipo,
} from "@prisma/client";
import {
  ensureConquistaTemplateMetodologia,
  unlockConquistaMetodologia,
  syncTemplatesMetodologiasProfissionais
} from "../services/conquistasMetodologia.js";

/** Pega userId do token (igual seu padrão) */
function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

function assinaturaDaAcesso(a: any) {
  if (!a) return false;
  if (a.status !== MetodologiaAssinaturaStatus.ATIVA) return false;
  if (a.expiraEm && new Date(a.expiraEm) <= new Date()) return false; // expirou
  return true;
}

function isPlanoMetodologiaAvulsa(plano: string | null | undefined) {
  const p = String(plano || "");
  return p.startsWith("METODOLOGIA:");
}

function metodologiaLimitFromPlano(plano: string | null | undefined): number {
  const p = String(plano || "").toUpperCase();

  // se o cara comprou uma metodologia avulsa, isso NÃO é "quota mensal"
  // (é acesso àquela metodologia específica via MetodologiaAssinante)
  if (isPlanoMetodologiaAvulsa(p)) return 0;

  // 1 por mês
  if (p === "ATLETA_LEARNING_1") return 1;
  if (p === "PROFESSOR_LEARNING_1") return 1;

  // 3 por mês
  if (p === "ATLETA_LEARNING_3") return 3;
  if (p === "PROFESSOR_LEARNING_3") return 3;
  if (p === "ORGANIZACOES_LEARNING_3") return 3;

  // Pro e outros: zero
  return 0;
}

function pickPrincipalAssinatura(assinaturas: Array<{ plano?: string | null; status?: string | null; ativo?: boolean | null }>) {
  // mesma regra do billing: assinatura principal = a primeira que NÃO é METODOLOGIA:<id>
  // e se possível ativa.
  const isAtiva = (a: any) => (a?.status === "ATIVA" || a?.status === "TRIAL") && a?.ativo === true;
  const isMetodo = (a: any) => String(a?.plano || "").startsWith("METODOLOGIA:");

  const ativa = assinaturas.find((a) => !isMetodo(a) && isAtiva(a));
  if (ativa) return ativa as any;

  const primeiraNaoMetodo = assinaturas.find((a) => !isMetodo(a));
  return (primeiraNaoMetodo ?? null) as any;
}

async function anexarCountsTipoPorMetodologia(ids: string[]) {
  if (!ids.length) return {};

  const grouped = await prisma.metodologiaItem.groupBy({
    by: ["metodologiaId", "tipo"],
    where: { metodologiaId: { in: ids } },
    _count: { _all: true },
  });

  return grouped.reduce((acc, g) => {
    const mid = g.metodologiaId;
    if (!acc[mid]) acc[mid] = { videoCount: 0, treinoCount: 0 };

    const tipoItem = String(g.tipo).toUpperCase();
    const qtd = g._count._all ?? 0;

    if (tipoItem === "VIDEO") acc[mid].videoCount += qtd;
    if (tipoItem === "TREINO") acc[mid].treinoCount += qtd;

    return acc;
  }, {} as Record<string, { videoCount: number; treinoCount: number }>);
}

export async function listMetodologias(req: Request, res: Response) {
  try {
    const criadorUsuarioId = (req.query.criadorUsuarioId as string) || undefined;

    const items = await prisma.metodologia.findMany({
      where: criadorUsuarioId ? { criadorUsuarioId } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias.", detail: e?.message });
  }
}

/** =========================
 * GET /api/metodologias/:id
 * ========================= */
export async function getMetodologiaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        itens: { orderBy: [{ semana: "asc" }, { ordem: "asc" }] },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });
    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar metodologia.", detail: e?.message });
  }
}

/** =========================
 * POST /api/metodologias
 * body: { titulo, descricao?, capaUrl?, totalSemanas?, nivel?, categorias? }
 * ========================= */
export async function createMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { titulo, descricao, capaUrl, totalSemanas, nivel, categorias, publicoAlvo } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Campo 'titulo' é obrigatório." });
    }

    // ✅ resolve o "dono real" (professor/clube/escolinha) a partir do usuário logado
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        tipo: true,
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
      },
    });

    const professorId =
      usuario?.tipo === "Professor" ? usuario?.professor?.id ?? null : null;

    const clubeId =
      usuario?.tipo === "Clube" ? usuario?.clube?.id ?? null : null;

    const escolinhaId =
      usuario?.tipo === "Escolinha" ? usuario?.escolinha?.id ?? null : null;

    let publicoAlvoFinal: MetodologiaPublicoAlvo = MetodologiaPublicoAlvo.AMBOS;

    if (publicoAlvo !== undefined && publicoAlvo !== null && String(publicoAlvo).trim() !== "") {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoFinal = raw as MetodologiaPublicoAlvo;
    }

    const created = await prisma.metodologia.create({
      data: {
        titulo: titulo.trim(),
        descricao: typeof descricao === "string" ? descricao.trim() : null,
        capaUrl: typeof capaUrl === "string" ? capaUrl.trim() : null,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : null,
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        publicoAlvo: publicoAlvoFinal,
        criadorUsuarioId: userId,
        professorId: professorId ?? undefined,
        clubeId: clubeId ?? undefined,
        escolinhaId: escolinhaId ?? undefined,
        ativo: false,
      },
      include: { _count: { select: { assinantes: true, itens: true } } },
    });

    // ✅ garante template de conquista (o service só cria se for PROFISSIONAIS)
    try {
      // garante/atualiza template se for profissionais, ou desativa se não for
      await ensureConquistaTemplateMetodologia(created.id);

      // opcional (recomendado): mantém o catálogo todo consistente
      // (bom pra caso tenha metodologias antigas sem template)
      await syncTemplatesMetodologiasProfissionais();
    } catch (e) {
      console.error("Falha ao sync template de conquista da metodologia:", e);
    }

    // ✅ ADICIONA NA ATIVIDADE RECENTE
    try {
      await prisma.atividadeRecente.create({
        data: {
          usuarioId: userId,
          tipo: "Metodologia",
          titulo: `Nova metodologia: ${created.titulo}`,
          imagemUrl: created.capaUrl ?? null,
          link: `/metodologias/${created.id}`,
          // createdAt: NÃO precisa (default now())
        },
      });
    } catch (e) {
      console.error("Falha ao criar AtividadeRecente da metodologia:", e);
    }

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao criar metodologia.", detail: e?.message });
  }
}

/** =========================
 * PUT /api/metodologias/:id
 * Edita (somente criador)
 * ========================= */
export async function updateMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const { titulo, descricao, capaUrl, totalSemanas, ativo, nivel, categorias, publicoAlvo } = req.body || {};

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para editar esta metodologia." });
    }

    let publicoAlvoUpdate: MetodologiaPublicoAlvo | undefined = undefined;

    if (publicoAlvo !== undefined) {
      const raw = String(publicoAlvo).toUpperCase().trim();
      const ok = (Object.values(MetodologiaPublicoAlvo) as string[]).includes(raw);
      if (!ok) {
        return res.status(400).json({
          message: "publicoAlvo inválido",
          recebido: publicoAlvo,
          esperado: Object.values(MetodologiaPublicoAlvo),
        });
      }
      publicoAlvoUpdate = raw as MetodologiaPublicoAlvo;
    }

    const capaUrlUpdate =
      capaUrl === null
        ? null
        : typeof capaUrl === "string"
          ? (capaUrl.trim() ? capaUrl.trim() : null)
          : undefined;

    const updated = await prisma.metodologia.update({
      where: { id },
      data: {
        titulo: typeof titulo === "string" ? titulo.trim() : undefined,
        descricao: typeof descricao === "string" ? descricao.trim() : undefined,
        capaUrl: capaUrlUpdate,
        totalSemanas: typeof totalSemanas === "number" ? totalSemanas : undefined,
        ativo: typeof ativo === "boolean" ? ativo : undefined,
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        ...(publicoAlvoUpdate !== undefined ? { publicoAlvo: publicoAlvoUpdate } : {}),
      },
      include: {
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    try {
      await ensureConquistaTemplateMetodologia(updated.id);
      await syncTemplatesMetodologiasProfissionais();
    } catch (e) {
      console.error("Falha ao sync template de conquista da metodologia:", e);
    }
    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao editar metodologia.", detail: e?.message });
  }
}

/** =========================
 * DELETE /api/metodologias/:id
 * Exclui (somente criador)
 * ========================= */
export async function deleteMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const current = await prisma.metodologia.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Metodologia não encontrada." });

    if (current.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para excluir esta metodologia." });
    }

    await prisma.metodologia.delete({ where: { id } });

    try {
      // como já deletou, ensure vai desativar met_prof_<id>
      await ensureConquistaTemplateMetodologia(id);
      await syncTemplatesMetodologiasProfissionais();
    } catch (e) {
      console.error("Falha ao sync template de conquista após delete metodologia:", e);
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao excluir metodologia.", detail: e?.message });
  }
}

export async function listMinhasMetodologiasAssinadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    // 1) pega assinatura principal (plano "principal")
    const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
      where: { usuarioId: userId },
      orderBy: { startsAt: "desc" },
    });

    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
    const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

    // ✅ NÃO retorna cedo: mesmo sem Learning, pode ter AVULSAS ativas
    const inicioMes = startOfMonth(new Date());
    const usadasNoMes =
      limite > 0
        ? await prisma.metodologiaAssinante.count({
            where: {
              usuarioId: userId,
              status: MetodologiaAssinaturaStatus.ATIVA,
              origem: MetodologiaAssinaturaOrigem.LEARNING,
              iniciouEm: { gte: inicioMes },
            },
          })
        : 0;
    
    // 3) lista as metodologias já ativas
    const rows = await prisma.metodologiaAssinante.findMany({
      where: {
        usuarioId: userId,
        status: MetodologiaAssinaturaStatus.ATIVA,
      },
      orderBy: { iniciouEm: "desc" },
      include: {
        metodologia: {
          include: {
            criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
            _count: { select: { assinantes: true, itens: true } },
          },
        },
      },
    });

    const metodologias = rows.map((r) => r.metodologia);
    const ids = metodologias.map((m) => m.id);
    const countsById = await anexarCountsTipoPorMetodologia(ids);

    return res.json({
      items: rows.map((r) => ({
        id: r.metodologia.id,
        titulo: r.metodologia.titulo,
        descricao: r.metodologia.descricao,
        capaUrl: r.metodologia.capaUrl ?? null,
        logoUrl: r.metodologia.capaUrl ?? null,
        categorias: r.metodologia.categorias ?? [],
        publicoAlvo: r.metodologia.publicoAlvo,
        criadorUsuario: r.metodologia.criadorUsuario,
        criadorNome: r.metodologia.criadorUsuario?.nome ?? null,
        _count: r.metodologia._count,
        videoCount: countsById[r.metodologia.id]?.videoCount ?? 0,
        treinoCount: countsById[r.metodologia.id]?.treinoCount ?? 0,
        assinada: true,
        iniciouEm: r.iniciouEm,
        status: r.status,
      })),
      quota: {
        limite,
        usadasNoMes,
        restantes: Math.max(0, limite - usadasNoMes),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar assinadas.", detail: e?.message });
  }
}

export async function listMinhasMetodologiasCriadas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const items = await prisma.metodologia.findMany({
      where: { criadorUsuarioId: userId },
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    const ids = items.map((m) => m.id);
    const countsById = await anexarCountsTipoPorMetodologia(ids);

    return res.json({
      items: items.map((m) => ({
        ...m,
        logoUrl: m.capaUrl ?? null,
        videoCount: countsById[m.id]?.videoCount ?? 0,
        treinoCount: countsById[m.id]?.treinoCount ?? 0,
        criadorNome: m.criadorUsuario?.nome ?? null,
      })),
    });

  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar minhas metodologias.", detail: e?.message });
  }
}

export async function listMetodologiasVisiveis(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    // ✅ pega tipo real do banco (não depende do middleware preencher req.user)
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tipo: true },
    });

    const tipo = String(user?.tipo ?? "").toLowerCase().trim();
    const publicoQuery = String(req.query.publico ?? "").toUpperCase().trim();

    let publicoPermitido: MetodologiaPublicoAlvo[] =
      tipo === "atleta"
        ? [MetodologiaPublicoAlvo.ATLETAS, MetodologiaPublicoAlvo.AMBOS]
        : [MetodologiaPublicoAlvo.PROFISSIONAIS, MetodologiaPublicoAlvo.AMBOS];

    // ✅ filtro do front manda "TODOS" | "ATLETAS" | "PROFISSIONAIS" | "AMBOS"
    if (publicoQuery === "TODOS") {
      publicoPermitido = [
        MetodologiaPublicoAlvo.ATLETAS,
        MetodologiaPublicoAlvo.PROFISSIONAIS,
        MetodologiaPublicoAlvo.AMBOS,
      ];
    } else if (
      publicoQuery === "ATLETAS" ||
      publicoQuery === "PROFISSIONAIS" ||
      publicoQuery === "AMBOS"
    ) {
      publicoPermitido = [publicoQuery as MetodologiaPublicoAlvo];
    }

    const items = await prisma.metodologia.findMany({
      where: {
        ativo: true,
        publicoAlvo: { in: publicoPermitido },
      },
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    // 2) conta itens por tipo (VIDEO / TREINO) e junta no retorno
    const ids = items.map((m) => m.id);
    let countsById: Record<string, { videoCount: number; treinoCount: number }> = {};

    if (ids.length) {
      const grouped = await prisma.metodologiaItem.groupBy({
        by: ["metodologiaId", "tipo"],
        where: { metodologiaId: { in: ids } },
        _count: { _all: true },
      });

      countsById = grouped.reduce((acc, g) => {
        const mid = g.metodologiaId;
        if (!acc[mid]) acc[mid] = { videoCount: 0, treinoCount: 0 };

        const tipoItem = String(g.tipo).toUpperCase();
        const qtd = g._count._all ?? 0;

        if (tipoItem === "VIDEO") acc[mid].videoCount += qtd;
        if (tipoItem === "TREINO") acc[mid].treinoCount += qtd;

        return acc;
      }, {} as Record<string, { videoCount: number; treinoCount: number }>);
    }

    const out = items.map((m) => ({
      ...m,
      videoCount: countsById[m.id]?.videoCount ?? 0,
      treinoCount: countsById[m.id]?.treinoCount ?? 0,
      logoUrl: m.capaUrl ?? null,
    }));

    return res.json({ items: out });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar visíveis.", detail: e?.message });
  }
}

type MetodologiaItemPreparado = {
  metodologiaId: string;
  semana: number;
  ordem: number | null;
  tipo: MetodologiaConteudoTipo;
  titulo: string;
  descricao: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  treinoProgramadoId: string | null;
  pontos: number | null;
  duracaoMin: number | null;
};

export async function createMetodologiaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId } = req.params;

    // 1) Confere se metodologia existe e se o user é o criador
    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia." });
    }

    // 2) Normaliza payload (aceita {itens:[...]} ou item direto)
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [body];

    if (!itensEntrada.length) {
      return res.status(400).json({ message: "Envie pelo menos 1 item." });
    }

    // 3) Valida e prepara itens
    const itensPreparados: MetodologiaItemPreparado[] = [];

    for (let i = 0; i < itensEntrada.length; i++) {
      const raw = itensEntrada[i] || {};

      const semana = Number(raw.semana);
      if (!Number.isFinite(semana) || semana < 1) {
        return res.status(400).json({ message: `Item #${i + 1}: 'semana' inválida.` });
      }

      const tipoStr = String(raw.tipo || "").toUpperCase().trim();

      const tiposPermitidos = ["VIDEO", "TREINO"] as const;

      if (!tiposPermitidos.includes(tipoStr as any)) {
        return res.status(400).json({
          message: `Item #${i + 1}: 'tipo' inválido.`,
          recebido: raw.tipo,
          esperado: tiposPermitidos,
        });
      }

      const tipo = tipoStr as MetodologiaConteudoTipo;

      const ordem =
        raw.ordem === undefined || raw.ordem === null || raw.ordem === ""
          ? null
          : Number(raw.ordem);

      if (ordem !== null && (!Number.isFinite(ordem) || ordem < 1)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'ordem' inválida.` });
      }

      const pontos =
        raw.pontos === undefined || raw.pontos === null || raw.pontos === ""
          ? null
          : Number(raw.pontos);

      if (pontos !== null && (!Number.isFinite(pontos) || pontos < 0)) {
        return res.status(400).json({ message: `Item #${i + 1}: 'pontos' inválido.` });
      }

      const treinoProgramadoId =
        typeof raw.treinoProgramadoId === "string" && raw.treinoProgramadoId.trim()
          ? raw.treinoProgramadoId.trim()
          : null;

      const videoUrl =
        typeof raw.videoUrl === "string" && raw.videoUrl.trim()
          ? raw.videoUrl.trim()
          : null;

      const thumbUrl =
        typeof raw.thumbUrl === "string" && raw.thumbUrl.trim()
          ? raw.thumbUrl.trim()
          : null;

      // Regras básicas por tipo (pode relaxar se quiser)
      if (tipo === "VIDEO" && !videoUrl) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo VIDEO exige 'videoUrl'.` });
      }
      if (tipo === "TREINO" && !treinoProgramadoId) {
        return res.status(400).json({ message: `Item #${i + 1}: tipo TREINO exige 'treinoProgramadoId'.` });
      }

      itensPreparados.push({
        metodologiaId,
        semana,
        ordem, // pode ser null (vamos auto setar)
        tipo: tipo as MetodologiaConteudoTipo, // string (Prisma enum também aceita string igual ao valor)
        titulo:
          typeof raw.titulo === "string" && raw.titulo.trim()
            ? raw.titulo.trim()
            : tipo === "VIDEO"
              ? "Vídeo da metodologia"
              : "Treino da metodologia",

        descricao: typeof raw.descricao === "string" ? raw.descricao.trim() : null,
        videoUrl,
        thumbUrl,
        treinoProgramadoId,
        pontos,
        duracaoMin:
          raw.duracaoMin === undefined || raw.duracaoMin === null || raw.duracaoMin === ""
            ? null
            : Number(raw.duracaoMin),
      });
    }

    // 4) Se ordem vier null, auto calcula (por semana)
    //    Fazemos isso num transaction para garantir consistência.
    const created = await prisma.$transaction(async (tx) => {
      const result = [];

      for (const item of itensPreparados) {
        let ordemFinal = item.ordem;

        if (!ordemFinal) {
          const last = await tx.metodologiaItem.findFirst({
            where: { metodologiaId, semana: item.semana },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });
          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const novo = await tx.metodologiaItem.create({
          data: {
            metodologiaId: item.metodologiaId,
            semana: item.semana,
            ordem: ordemFinal,
            tipo: item.tipo,
            titulo: item.titulo,
            descricao: item.descricao,
            videoUrl: item.videoUrl,
            thumbUrl: item.thumbUrl,
            treinoProgramadoId: item.treinoProgramadoId,
            pontos: item.pontos,
            duracaoMin:
              item.duracaoMin !== null && Number.isFinite(item.duracaoMin)
                ? item.duracaoMin
                : null,
          },
        });

        // ✅ PASSO 2: se for TREINO, garante vínculo na MetodologiaTreino
        if (item.tipo === MetodologiaConteudoTipo.TREINO && item.treinoProgramadoId) {
          await tx.metodologiaTreino.upsert({
            where: {
              metodologiaId_treinoProgramadoId: {
                metodologiaId,
                treinoProgramadoId: item.treinoProgramadoId,
              },
            },
            update: {},
            create: {
              metodologiaId,
              treinoProgramadoId: item.treinoProgramadoId,
            },
          });
        }

        result.push(novo);
      }

      return result;
    });

    return res.status(201).json({ itens: created });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao adicionar itens.", detail: e?.message });
  }
}

export async function getMetodologiaDetalhe(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        itens: {
          orderBy: [{ semana: "asc" }, { ordem: "asc" }],
          include: {
            treinoProgramado: { select: { id: true, nome: true, imagemUrl: true } },
          },
        },
        _count: { select: { assinantes: true, itens: true } },
      },
    });

    if (!metodologia) return res.status(404).json({ message: "Metodologia não encontrada." });

    const assinatura = await prisma.metodologiaAssinante.findUnique({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
    });

    const podeAvaliar =
      !!assinatura && ((assinatura as any).status === "CONCLUIDA" || !!(assinatura as any).concluiuEm);

    const minhaAvaliacao = await prisma.avaliacaoMetodologia.findUnique({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
      select: { nota: true, comentario: true, updatedAt: true },
    });

    const hasAccess = assinaturaDaAcesso(assinatura);
    // progresso (sem mudar banco): tenta ler progresso.concluidos (array de itemId)
    const concluidosIds: string[] = Array.isArray((assinatura as any)?.progresso?.concluidos)
      ? ((assinatura as any).progresso.concluidos as string[])
      : [];

    // agrupa por semana
    const weeksMap = new Map<number, any[]>();
    for (const it of metodologia.itens) {
      if (!weeksMap.has(it.semana)) weeksMap.set(it.semana, []);
      weeksMap.get(it.semana)!.push(it);
    }
    // ✅ soma de pontos total
    const pontosTotal = metodologia.itens.reduce((acc, it) => acc + (it.pontos ?? 0), 0);
    // ✅ regra de quota (mesma lógica da listMinhasMetodologiasAssinadas)
    const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
      where: { usuarioId: userId },
      orderBy: { startsAt: "desc" },
    });

    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
    const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);
    const inicioMes = startOfMonth(new Date());
    const usadasNoMes = await prisma.metodologiaAssinante.count({
      where: {
        usuarioId: userId,
        status: MetodologiaAssinaturaStatus.ATIVA,
        origem: MetodologiaAssinaturaOrigem.LEARNING,
        iniciouEm: { gte: inicioMes },
      },
    });

    const assinaturaTipo = assinatura
      ? (assinatura.origem === MetodologiaAssinaturaOrigem.AVULSA ? "AVULSA" : "LEARNING")
      : null;

    const podeAssinarAgora = !hasAccess && limite > 0 && usadasNoMes < limite;

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tipo: true },
    });

    const tipoUsuario = String(u?.tipo ?? "").toUpperCase();
    const isAdmin = tipoUsuario === "ADMIN" || tipoUsuario === "ADMINISTRADOR";
    const isOwner = metodologia.criadorUsuarioId === userId;
    const podeVerVideo = hasAccess || isOwner || isAdmin;
    const itens = metodologia.itens.map((it) => ({
      id: it.id,
      semana: it.semana,
      ordem: it.ordem,
      tipo: it.tipo,
      titulo: it.titulo,
      descricao: it.descricao,
      pontos: it.pontos,
      // ✅ thumb e duração sempre (preview)
      thumbUrl: it.thumbUrl,
      duracaoMin: it.duracaoMin,
      // ✅ vídeo só se tiver acesso OU for criador/admin
      videoUrl: podeVerVideo ? it.videoUrl : null,
      treinoProgramadoId: it.treinoProgramadoId,
      treinoProgramado: it.treinoProgramado
        ? { id: it.treinoProgramado.id, nome: it.treinoProgramado.nome, imagemUrl: it.treinoProgramado.imagemUrl }
        : null,
      publicado: it.publicado,
    }));

    let motivoBloqueio: string | null = null;

    if (hasAccess) {
      motivoBloqueio = "JA_ASSINADA";
    } else if (podeAssinarAgora) {
      motivoBloqueio = null; // pode selecionar via Learning
    } else if (limite <= 0) {
      // ✅ sem learning → oferece compra avulsa
      motivoBloqueio = "PRECISA_PAGAR_AVULSA";
    } else {
      // limite > 0 mas já estourou
      motivoBloqueio = "LIMITE_METODOLOGIAS";
    }

    return res.json({
      id: metodologia.id,
      titulo: metodologia.titulo,
      descricao: metodologia.descricao,
      capaUrl: metodologia.capaUrl ?? null,
      publicoAlvo: metodologia.publicoAlvo,
      totalSemanas: metodologia.totalSemanas ?? null,
      totalAssinantes: metodologia.totalAssinantes ?? 0,
      mediaAvaliacao: metodologia.mediaAvaliacao ?? 0,
      totalReviews: metodologia.totalReviews ?? 0,
      pontosTotal,
      criadorNome: metodologia.criadorUsuario?.nome ?? null,
      // ✅ aqui seu front usa direto data.itens
      itens: itens,
      viewer: {
        // compat (se quiser manter)
        isAssinante: hasAccess,
        // ✅ o que o front realmente usa
        temAcesso: hasAccess,
        assinaturaTipo,
        expiraEm: assinatura?.expiraEm ? new Date(assinatura.expiraEm).toISOString() : null,
        podeAssinarAgora: hasAccess ? false : podeAssinarAgora,
        motivoBloqueio,
        podeAvaliar,
        minhaAvaliacao,
        progresso: { concluidos: concluidosIds },
        // pode manter, mas atualize seu type do front se quiser tipar
        quota: {
          limite,
          usadasNoMes,
          restantes: Math.max(0, limite - usadasNoMes),
        },
      },
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar detalhe da metodologia.", detail: e?.message });
  }
}

export async function assinarMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;

    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      select: { id: true, ativo: true },
    });

    if (!metodologia || metodologia.ativo === false) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    // ✅ origem pode vir por query ou body
    const origemRaw = String(req.query.origem ?? req.body?.origem ?? MetodologiaAssinaturaOrigem.LEARNING)
      .toUpperCase()
      .trim();

    const origem =
      origemRaw === "AVULSA"
        ? MetodologiaAssinaturaOrigem.AVULSA
        : MetodologiaAssinaturaOrigem.LEARNING;

    // Já tem assinatura?
    const existing = await prisma.metodologiaAssinante.findUnique({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
    });

    // Se já tem acesso ativo, não faz nada
    if (existing && assinaturaDaAcesso(existing)) {
      return res.json({ ok: true, already: true });
    }

    const agora = new Date();

    // ✅ Expiração: Learning = 1 mês | Avulsa = 1 ano
    const expiraEm =
      origem === MetodologiaAssinaturaOrigem.AVULSA ? addYears(agora, 1) : addMonths(agora, 1);

    // ✅ Se for LEARNING, aplica quota mensal
    if (origem === MetodologiaAssinaturaOrigem.LEARNING) {
      const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
        where: { usuarioId: userId },
        orderBy: { startsAt: "desc" },
      });

      const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
      const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

      if (limite <= 0) {
        return res.status(403).json({
          code: "PRECISA_LEARNING",
          message: "Você precisa ter Learning ativo para selecionar metodologias.",
        });
      }

      const inicioMes = startOfMonth(new Date());
      const usadasNoMes = await prisma.metodologiaAssinante.count({
        where: {
          usuarioId: userId,
          status: MetodologiaAssinaturaStatus.ATIVA,
          origem: MetodologiaAssinaturaOrigem.LEARNING,
          iniciouEm: { gte: inicioMes },
        },
      });

      if (usadasNoMes >= limite) {
        return res.status(403).json({
          code: "LIMITE_METODOLOGIAS",
          message: `Você já selecionou ${usadasNoMes}/${limite} metodologias neste ciclo.`,
        });
      }
    }

    // ✅ Cria/reativa assinatura com expiraEm correto
    await prisma.metodologiaAssinante.upsert({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
      create: {
        metodologiaId: id,
        usuarioId: userId,
        status: MetodologiaAssinaturaStatus.ATIVA,
        origem,
        iniciouEm: agora,
        expiraEm,
        progresso: { concluidos: [] } as any,
      },
      update: {
        status: MetodologiaAssinaturaStatus.ATIVA,
        origem,
        iniciouEm: agora,
        expiraEm,
      },
    });

    return res.json({ ok: true, origem, expiraEm });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao assinar metodologia.", detail: e?.message });
  }
}

export async function deleteMetodologiaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId } = req.params;

    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true, criadorUsuarioId: true },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para alterar esta metodologia." });
    }

    const del = await prisma.metodologiaItem.deleteMany({
      where: { metodologiaId },
    });

    return res.json({ ok: true, deleted: del.count });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao limpar itens.", detail: e?.message });
  }
}

export async function criarAvaliacaoMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { metodologiaId, nota, comentario } = req.body || {};

    if (!metodologiaId || typeof metodologiaId !== "string") {
      return res.status(400).json({ message: "metodologiaId é obrigatório." });
    }

    const n = Number(nota);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      return res.status(400).json({ message: "nota inválida (0 a 5)." });
    }

    // ✅ existe?
    const existe = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: { id: true },
    });
    if (!existe) return res.status(404).json({ message: "Metodologia não encontrada." });

    const assinatura = await prisma.metodologiaAssinante.findUnique({
      where: { metodologiaId_usuarioId: { metodologiaId, usuarioId: userId } },
      select: { status: true, concluiuEm: true },
    });

    const podeAvaliar =
      !!assinatura && ((assinatura as any).status === "CONCLUIDA" || !!(assinatura as any).concluiuEm);

    if (!podeAvaliar) {
      return res.status(403).json({
        error: "Só pode avaliar quem assinou e concluiu a metodologia.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.avaliacaoMetodologia.upsert({
        where: {
          metodologiaId_usuarioId: { metodologiaId, usuarioId: userId },
        },
        create: {
          metodologiaId,
          usuarioId: userId,
          nota: Math.round(n),
          comentario: typeof comentario === "string" ? comentario.trim() : null,
        },
        update: {
          nota: Math.round(n),
          comentario: typeof comentario === "string" ? comentario.trim() : null,
        },
        select: { id: true, nota: true, comentario: true, updatedAt: true },
      });

      // ✅ recalcula média + total no banco (fonte da verdade)
      const agg = await tx.avaliacaoMetodologia.aggregate({
        where: { metodologiaId },
        _avg: { nota: true },
        _count: { _all: true },
      });

      const media = Number(agg._avg.nota ?? 0);
      const total = Number(agg._count._all ?? 0);

      await tx.metodologia.update({
        where: { id: metodologiaId },
        data: {
          mediaAvaliacao: media,
          totalReviews: total,
        },
        select: { id: true },
      });

      return { review, mediaAvaliacao: media, totalReviews: total };
    });

    return res.status(201).json({
      ok: true,
      avaliacao: result.review,
      mediaAvaliacao: result.mediaAvaliacao,
      totalReviews: result.totalReviews,
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao salvar avaliação.", detail: e?.message });
  }
}

export async function concluirItemMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params; // metodologiaId
    const { itemId } = req.body || {};

    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ message: "itemId é obrigatório." });
    }

    // Confere se item pertence à metodologia e pega pontos
    const item = await prisma.metodologiaItem.findFirst({
      where: { id: itemId, metodologiaId: id },
      select: { id: true, pontos: true },
    });

    if (!item) return res.status(404).json({ message: "Item não encontrado nessa metodologia." });

    // Confere assinatura e acesso
    const assinatura = await prisma.metodologiaAssinante.findUnique({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
    });

    if (!assinatura || !assinaturaDaAcesso(assinatura)) {
      return res.status(403).json({ message: "Sem acesso à metodologia." });
    }

    const progresso: any = (assinatura as any).progresso || {};
    const concluidos: string[] = Array.isArray(progresso.concluidos) ? progresso.concluidos : [];
    const jaTinha = concluidos.includes(itemId);
    const novoConcluidos = jaTinha ? concluidos : [...concluidos, itemId];
    // ✅ opcional: guardar pontos ganhos só 1x
    const pontosGanhos = Number(item.pontos ?? 0);
    const pontosTotaisAntes = Number(progresso.pontosGanhos ?? 0);
    const pontosGanhosAgora = jaTinha ? 0 : pontosGanhos;

    const progressoNovo = {
      ...progresso,
      concluidos: novoConcluidos,
      pontosGanhos: pontosTotaisAntes + pontosGanhosAgora,
      // ajuda pra debug
      atualizadoEm: new Date().toISOString(),
    };

    await prisma.metodologiaAssinante.update({
      where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
      data: { progresso: progressoNovo as any },
    });

    // ✅ calcula se a metodologia ficou completa (comparando total publicado vs concluidos)
    const totalPublicados = await prisma.metodologiaItem.count({
      where: { metodologiaId: id, publicado: true },
    });

    const metodologiaCompleta = totalPublicados > 0 && novoConcluidos.length >= totalPublicados;

    if (metodologiaCompleta) {
      await prisma.metodologiaAssinante.update({
        where: { metodologiaId_usuarioId: { metodologiaId: id, usuarioId: userId } },
        data: {
          status: MetodologiaAssinaturaStatus.CONCLUIDA as any,
          concluiuEm: new Date() as any,
        },
      });

      // ✅ AQUI É O (A): dá a conquista (idempotente)
      try {
        await unlockConquistaMetodologia(userId, id);
      } catch (e) {
        console.error("Falha ao desbloquear conquista da metodologia:", e);
      }
    }

    return res.json({
      ok: true,
      jaTinha,
      pontosGanhosAgora,
      metodologiaCompleta, // ✅ ESSENCIAL pro Caminho 1
      progresso: {
        concluidos: novoConcluidos,
        pontosGanhos: progressoNovo.pontosGanhos,
        totalPublicados,
        concluidosCount: novoConcluidos.length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao concluir item.", detail: e?.message });
  }
}