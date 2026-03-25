// server/controllers/metodologiasController
import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { startOfMonth, addMonths, addYears } from "date-fns";
import {
  MetodologiaAssinaturaStatus,
  MetodologiaAssinaturaOrigem,
  MetodologiaPublicoAlvo,
  MetodologiaConteudoTipo,
  MetodologiaTipo,
  MetodologiaEstruturaTipo,
  MetodologiaModoExecucao,
  MetodologiaItemTipo,
  MetodologiaProgressoStatus,
} from "@prisma/client";
import {
  ensureConquistaTemplateMetodologia,
  unlockConquistaMetodologia,
  syncTemplatesMetodologiasProfissionais
} from "../services/conquistasMetodologia.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";

function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

function asNullableString(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function asNullableNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: any, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(s)) return true;
    if (["false", "0", "nao", "não", "no"].includes(s)) return false;
  }
  return fallback;
}

function isValidEnumValue<T extends Record<string, string>>(enumObj: T, value: any): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}

async function validarMetodologiaDoCriador(metodologiaId: string, userId: string) {
  const metodologia = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      criadorUsuarioId: true,
      tipo: true,
      estruturaTipo: true,
      ativo: true,
      geraBadge: true,
      geraCertificado: true,
    },
  });

  if (!metodologia) {
    return { erro: { status: 404, message: "Metodologia não encontrada." } };
  }

  if (metodologia.criadorUsuarioId !== userId) {
    return { erro: { status: 403, message: "Você não tem permissão para alterar esta metodologia." } };
  }

  return { metodologia };
}

async function recalcularStatusMetodologiaAssinante(metodologiaId: string, usuarioId: string) {
  const assinatura = await prisma.metodologiaAssinante.findUnique({
    where: {
      metodologiaId_usuarioId: {
        metodologiaId,
        usuarioId,
      },
    },
    select: {
      id: true,
      progresso: true,
      status: true,
      concluiuEm: true,
    },
  });

  if (!assinatura) return null;

  const [totalItens, totalConcluidos] = await Promise.all([
    prisma.metodologiaEstruturaItem.count({
      where: {
        estrutura: {
          metodologiaId,
        },
        publicado: true,
      },
    }),
    prisma.metodologiaProgressoEstrutura.count({
      where: {
        metodologiaAssinanteId: assinatura.id,
        status: MetodologiaProgressoStatus.CONCLUIDA,
      },
    }),
  ]);

  const payload: any = assinatura.progresso && typeof assinatura.progresso === "object"
    ? { ...(assinatura.progresso as any) }
    : {};

  payload.totalItens = totalItens;
  payload.estruturasConcluidas = totalConcluidos;

  const todasEstruturas = await prisma.metodologiaEstrutura.count({
    where: { metodologiaId, ativo: true },
  });

  const concluiuTudo = todasEstruturas > 0 && totalConcluidos >= todasEstruturas;

  const updated = await prisma.metodologiaAssinante.update({
    where: { id: assinatura.id },
    data: {
      progresso: payload,
      status: concluiuTudo ? MetodologiaAssinaturaStatus.CONCLUIDA : assinatura.status,
      concluiuEm: concluiuTudo ? (assinatura.concluiuEm ?? new Date()) : assinatura.concluiuEm,
    },
  });

  if (concluiuTudo) {
    await unlockConquistaMetodologia(usuarioId, metodologiaId).catch(() => null);
  }

  return updated;
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

async function anexarCountsEstruturaPorMetodologia(ids: string[]) {
  const out: Record<
    string,
    {
      treinoCount: number;
      videoCount: number;
      aulaCount: number;
      materialCount: number;
      desafioCount: number;
      estruturaCount: number;
    }
  > = {};

  if (!ids.length) return out;

  const [estruturas, itens] = await Promise.all([
    prisma.metodologiaEstrutura.findMany({
      where: { metodologiaId: { in: ids } },
      select: { id: true, metodologiaId: true },
    }),
    prisma.metodologiaEstruturaItem.findMany({
      where: {
        estrutura: {
          metodologiaId: { in: ids },
        },
      },
      select: {
        tipo: true,
        estrutura: {
          select: {
            metodologiaId: true,
          },
        },
      },
    }),
  ]);

  for (const id of ids) {
    out[id] = {
      treinoCount: 0,
      videoCount: 0,
      aulaCount: 0,
      materialCount: 0,
      desafioCount: 0,
      estruturaCount: 0,
    };
  }

  for (const e of estruturas) {
    if (!out[e.metodologiaId]) continue;
    out[e.metodologiaId].estruturaCount++;
  }

  for (const it of itens) {
    const metodologiaId = it.estrutura.metodologiaId;
    if (!out[metodologiaId]) continue;

    if (it.tipo === MetodologiaItemTipo.TREINO) out[metodologiaId].treinoCount++;
    if (it.tipo === MetodologiaItemTipo.VIDEO) out[metodologiaId].videoCount++;
    if (it.tipo === MetodologiaItemTipo.AULA) out[metodologiaId].aulaCount++;
    if (it.tipo === MetodologiaItemTipo.MATERIAL) out[metodologiaId].materialCount++;
    if (it.tipo === MetodologiaItemTipo.DESAFIO) out[metodologiaId].desafioCount++;
  }

  return out;
}

export async function listMetodologias(req: Request, res: Response) {
  try {
    const criadorUsuarioId = (req.query.criadorUsuarioId as string) || undefined;

    const items = await prisma.metodologia.findMany({
      where: criadorUsuarioId ? { criadorUsuarioId } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias.", detail: e?.message });
  }
}

export async function getMetodologiaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });
    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao buscar metodologia.", detail: e?.message });
  }
}

export async function createMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const {
      titulo,
      descricao,
      capaUrl,
      publicoAlvo,
      categorias,
      nivel,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
      totalSemanas,
    } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    if (!tipo || !Object.values(MetodologiaTipo).includes(tipo)) {
      return res.status(400).json({ message: "tipo inválido." });
    }

    if (!estruturaTipo || !Object.values(MetodologiaEstruturaTipo).includes(estruturaTipo)) {
      return res.status(400).json({ message: "estruturaTipo inválido." });
    }

    if (
      tipo === MetodologiaTipo.TRILHAS_TREINO &&
      estruturaTipo !== MetodologiaEstruturaTipo.TRILHA
    ) {
      return res.status(400).json({
        message: "Metodologia de trilhas de treino deve usar estruturaTipo=TRILHA.",
      });
    }

    if (
      tipo === MetodologiaTipo.CURSO_FORMACAO &&
      estruturaTipo !== MetodologiaEstruturaTipo.MODULO
    ) {
      return res.status(400).json({
        message: "Metodologia de curso/formação deve usar estruturaTipo=MODULO.",
      });
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
        nivel: nivel ?? undefined,
        categorias: Array.isArray(categorias) ? categorias : undefined,
        publicoAlvo: publicoAlvoFinal,
        criadorUsuarioId: userId,
        professorId: professorId ?? undefined,
        clubeId: clubeId ?? undefined,
        escolinhaId: escolinhaId ?? undefined,
        ativo: false,
        tipo,
        estruturaTipo,
        area: area ?? null,
        geraBadge: !!geraBadge,
        geraCertificado: !!geraCertificado,
        totalSemanas: totalSemanas ?? null, // legado, enquanto existir
      },
      include: { _count: { select: { assinantes: true, estruturas: true } } },
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

export async function updateMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { id } = req.params;
    const {
      titulo,
      descricao,
      capaUrl,
      totalSemanas,
      ativo,
      nivel,
      categorias,
      publicoAlvo,
      tipo,
      estruturaTipo,
      area,
      geraBadge,
      geraCertificado,
    } = req.body || {};

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

    // ✅ NOVIDADE: Se a capa está sendo atualizada/removida, apaga a antiga do S3
    if (capaUrlUpdate !== undefined && current.capaUrl && current.capaUrl !== capaUrlUpdate && current.capaUrl.includes("amazonaws.com")) {
      await deleteFromS3(current.capaUrl);
    }

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
        ...(tipo !== undefined ? { tipo } : {}),
        ...(estruturaTipo !== undefined ? { estruturaTipo } : {}),
        ...(area !== undefined ? { area } : {}),
        ...(geraBadge !== undefined ? { geraBadge: !!geraBadge } : {}),
        ...(geraCertificado !== undefined ? { geraCertificado: !!geraCertificado } : {}),
      },
      include: {
        _count: { select: { assinantes: true, estruturas: true } },
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
export const deleteMetodologia = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getUserId(req);

  try {
    // 1. Busca a metodologia incluindo os itens de vídeo
    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      select: { 
        capaUrl: true, 
        criadorUsuarioId: true,
        estruturas: {
          select: {
            itens: {
              select: { videoUrl: true },
            },
          },
        },
      }
    });

    if (!metodologia) {
      return res.status(404).json({ error: "Metodologia não encontrada." });
    }

    // Segurança extra
    if (metodologia.criadorUsuarioId !== userId) {
      return res.status(403).json({ message: "Sem permissão para deletar." });
    }

    // 2. Deleta do Banco de Dados (Os itens são deletados por CASCADE no Prisma)
    await prisma.metodologia.delete({
      where: { id },
    });

    // 3. Limpeza do S3
    // 3.1 Apaga a capa
    if (metodologia.capaUrl && metodologia.capaUrl.includes("amazonaws.com")) {
      await deleteFromS3(metodologia.capaUrl);
    }

    if (metodologia) {
      for (const estrutura of metodologia.estruturas) {
        for (const item of estrutura.itens) {
          if (item.videoUrl && item.videoUrl.includes("amazonaws.com")) {
            await deleteFromS3(item.videoUrl);
          }
        }
      }
    }

    return res.json({ ok: true, message: "Metodologia e mídia removidas com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar metodologia:", error);
    return res.status(500).json({ error: "Erro interno ao deletar." });
  }
};

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
            _count: { select: { assinantes: true, estruturas: true } },
          },
        },
      },
    });

    const metodologias = rows.map((r) => r.metodologia);
    const ids = metodologias.map((m) => m.id);
    const countsById = await anexarCountsEstruturaPorMetodologia(ids);

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
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    const ids = items.map((m) => m.id);
    const countsById = await anexarCountsEstruturaPorMetodologia(ids);

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

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tipo: true },
    });

    const tipo = String(user?.tipo ?? "").toLowerCase().trim();
    const publicoQuery = String(req.query.publico ?? "").toUpperCase().trim();

    const publicoPermitido: MetodologiaPublicoAlvo[] = [
      MetodologiaPublicoAlvo.ATLETAS,
      MetodologiaPublicoAlvo.PROFISSIONAIS,
      MetodologiaPublicoAlvo.AMBOS,
    ];
    
    const items = await prisma.metodologia.findMany({
      where: {
        ativo: true,
        publicoAlvo: { in: publicoPermitido },
      },
      orderBy: { criadoEm: "desc" },
      include: {
        criadorUsuario: { select: { id: true, nome: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    const ids = items.map((m) => m.id);
    const countsById = await anexarCountsEstruturaPorMetodologia(ids);

    const out = items.map((m) => ({
      ...m,
      videoCount: countsById[m.id]?.videoCount ?? 0,
      treinoCount: countsById[m.id]?.treinoCount ?? 0,
      aulaCount: countsById[m.id]?.aulaCount ?? 0,
      materialCount: countsById[m.id]?.materialCount ?? 0,
      desafioCount: countsById[m.id]?.desafioCount ?? 0,
      estruturaCount: countsById[m.id]?.estruturaCount ?? 0,
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
        estruturas: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              where: { publicado: true },
              orderBy: { ordem: "asc" },
              include: {
                treinoProgramado: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    imagemUrl: true,
                    nivel: true,
                    categoria: true,
                    pontuacao: true,
                    duracao: true,
                    objetivo: true,
                    tipoTreino: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { assinantes: true, estruturas: true } },
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
    const concluidosIds: string[] = Array.isArray((assinatura as any)?.progresso?.concluidos)
      ? ((assinatura as any).progresso.concluidos as string[])
      : [];

    // ✅ regra de quota / Learning
    const assinaturasPrincipais = await (prisma as any).assinatura.findMany({
      where: { usuarioId: userId },
      orderBy: { startsAt: "desc" },
    });

    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasPrincipais as any[]);
    const limite = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);

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

    const assinaturaTipo = assinatura
      ? (assinatura.origem === MetodologiaAssinaturaOrigem.AVULSA ? "AVULSA" : "LEARNING")
      : null;

    const podeAssinarAgora = !hasAccess && limite > 0 && usadasNoMes < limite;

    const pontosTotal = metodologia.estruturas.reduce((accEstrutura, estrutura) => {
      const somaEstrutura = estrutura.itens.reduce((accItem, item) => accItem + Number(item.pontos ?? 0), 0);
      return accEstrutura + somaEstrutura;
    }, 0);

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tipo: true },
    });

    const tipoUsuario = String(u?.tipo ?? "").toUpperCase();
    const isAdmin = tipoUsuario === "ADMIN" || tipoUsuario === "ADMINISTRADOR";
    const isOwner = metodologia.criadorUsuarioId === userId;
    const podeVerVideo = hasAccess || isOwner || isAdmin;

    const estruturas = metodologia.estruturas.map((estrutura) => ({
      id: estrutura.id,
      tipo: estrutura.tipo,
      titulo: estrutura.titulo,
      descricao: estrutura.descricao,
      objetivo: estrutura.objetivo,
      ordem: estrutura.ordem,
      duracaoSemanas: estrutura.duracaoSemanas,
      treinosPorSemana: estrutura.treinosPorSemana,
      quantidadeMinConclusao: estrutura.quantidadeMinConclusao,
      modoExecucao: estrutura.modoExecucao,
      pontosPorItem: estrutura.pontosPorItem,
      bonusConsistencia: estrutura.bonusConsistencia,
      bonusFinal: estrutura.bonusFinal,
      ativo: estrutura.ativo,
      itens: estrutura.itens.map((item) => ({
        id: item.id,
        ordem: item.ordem,
        tipo: item.tipo,
        titulo: item.titulo,
        descricao: item.descricao,
        pontos: item.pontos,
        thumbUrl: item.thumbUrl,
        duracaoMin: item.duracaoMin,
        videoUrl: podeVerVideo ? item.videoUrl : null,
        arquivoUrl: item.arquivoUrl ?? null,
        materialUrl: item.materialUrl ?? null,
        treinoProgramadoId: item.treinoProgramadoId,
        treinoProgramado: item.treinoProgramado
          ? {
              id: item.treinoProgramado.id,
              nome: item.treinoProgramado.nome,
              imagemUrl: item.treinoProgramado.imagemUrl,
              codigo: item.treinoProgramado.codigo,
              nivel: item.treinoProgramado.nivel,
              categoria: item.treinoProgramado.categoria,
              pontuacao: item.treinoProgramado.pontuacao,
              duracao: item.treinoProgramado.duracao,
              objetivo: item.treinoProgramado.objetivo,
              tipoTreino: item.treinoProgramado.tipoTreino,
            }
          : null,
        publicado: item.publicado,
        obrigatorio: item.obrigatorio,
      })),
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
        nivel: metodologia.nivel ?? "Base",
        totalSemanas: metodologia.totalSemanas ?? null,
        totalAssinantes: metodologia.totalAssinantes ?? 0,
        mediaAvaliacao: metodologia.mediaAvaliacao ?? 0,
        totalReviews: metodologia.totalReviews ?? 0,
        pontosTotal,
        criadorNome: metodologia.criadorUsuario?.nome ?? null,
        estruturas,
        viewer: {
          isAssinante: hasAccess,
          temAcesso: hasAccess,
          assinaturaTipo,
          expiraEm: assinatura?.expiraEm ? new Date(assinatura.expiraEm).toISOString() : null,
          podeAssinarAgora,
          motivoBloqueio,
          podeAvaliar,
          minhaAvaliacao,
          progresso: { concluidos: concluidosIds },
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

export async function createMetodologiaEstruturas(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId } = req.params;
    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const metodologia = validacao.metodologia;
    const body = req.body || {};
    const entrada = Array.isArray(body.estruturas) ? body.estruturas : [body];

    if (!entrada.length) {
      return res.status(400).json({ message: "Envie ao menos uma estrutura." });
    }

    const criadas = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const item of entrada) {
        const titulo = String(item?.titulo ?? "").trim();
        const descricao = asNullableString(item?.descricao);
        const objetivo = asNullableString(item?.objetivo);
        const ordemInformada = asNullableNumber(item?.ordem);
        const tipoEstrutura = item?.tipo ?? metodologia.estruturaTipo;
        const duracaoSemanas = asNullableNumber(item?.duracaoSemanas);
        const treinosPorSemana = asNullableNumber(item?.treinosPorSemana);
        const quantidadeMinConclusao = asNullableNumber(item?.quantidadeMinConclusao);
        const pontosPorItem = asNullableNumber(item?.pontosPorItem);
        const bonusConsistencia = asNullableNumber(item?.bonusConsistencia);
        const bonusFinal = asNullableNumber(item?.bonusFinal);
        const prazoFinal = item?.prazoFinal ? new Date(item.prazoFinal) : null;
        const permiteAtraso = asBool(item?.permiteAtraso, true);
        const ativo = asBool(item?.ativo, true);
        const modoExecucao = item?.modoExecucao ?? null;

        if (!titulo) {
          throw new Error("Cada estrutura precisa ter título.");
        }

        if (!isValidEnumValue(MetodologiaEstruturaTipo, tipoEstrutura)) {
          throw new Error(`Tipo de estrutura inválido para "${titulo}".`);
        }

        if (!metodologia.estruturaTipo) {
          throw new Error("A metodologia ainda não tem estruturaTipo definido. Atualize a metodologia antes de criar trilhas ou módulos.");
        }

        if (tipoEstrutura !== metodologia.estruturaTipo) {
          throw new Error(`A metodologia aceita apenas estruturas do tipo ${metodologia.estruturaTipo}.`);
        }

        if (!metodologia.estruturaTipo) {
          return res.status(400).json({
            message: "A metodologia precisa ter estruturaTipo definido antes de editar a estrutura.",
          });
        }

        if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA) {
          if (!duracaoSemanas || duracaoSemanas <= 0) {
            throw new Error(`A trilha "${titulo}" exige duracaoSemanas válida.`);
          }

          if (!treinosPorSemana || treinosPorSemana <= 0) {
            throw new Error(`A trilha "${titulo}" exige treinosPorSemana válido.`);
          }

          if (modoExecucao && !isValidEnumValue(MetodologiaModoExecucao, modoExecucao)) {
            throw new Error(`modoExecucao inválido na trilha "${titulo}".`);
          }
        }

        if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.MODULO) {
          if (modoExecucao && !isValidEnumValue(MetodologiaModoExecucao, modoExecucao)) {
            throw new Error(`modoExecucao inválido no módulo "${titulo}".`);
          }
        }

        let ordemFinal = ordemInformada;

        if (!ordemFinal || ordemFinal <= 0) {
          const last = await tx.metodologiaEstrutura.findFirst({
            where: { metodologiaId },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });

          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const nova = await tx.metodologiaEstrutura.create({
          data: {
            metodologiaId,
            tipo: tipoEstrutura,
            titulo,
            descricao,
            objetivo,
            ordem: ordemFinal,
            duracaoSemanas,
            treinosPorSemana,
            quantidadeMinConclusao,
            modoExecucao: modoExecucao ?? null,
            pontosPorItem,
            bonusConsistencia,
            bonusFinal,
            prazoFinal,
            permiteAtraso,
            ativo,
          },
        });

        out.push(nova);
      }

      return out;
    });

    return res.status(201).json({ estruturas: criadas });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar estruturas da metodologia.",
      detail: e?.message,
    });
  }
}

export async function updateMetodologiaEstrutura(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const metodologia = validacao.metodologia;

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const body = req.body || {};

    const titulo = body.titulo !== undefined ? String(body.titulo ?? "").trim() : undefined;
    const descricao = body.descricao !== undefined ? asNullableString(body.descricao) : undefined;
    const objetivo = body.objetivo !== undefined ? asNullableString(body.objetivo) : undefined;
    const ordem = body.ordem !== undefined ? asNullableNumber(body.ordem) : undefined;
    const ativo = body.ativo !== undefined ? asBool(body.ativo, true) : undefined;

    const duracaoSemanas = body.duracaoSemanas !== undefined ? asNullableNumber(body.duracaoSemanas) : undefined;
    const treinosPorSemana = body.treinosPorSemana !== undefined ? asNullableNumber(body.treinosPorSemana) : undefined;
    const quantidadeMinConclusao = body.quantidadeMinConclusao !== undefined ? asNullableNumber(body.quantidadeMinConclusao) : undefined;
    const pontosPorItem = body.pontosPorItem !== undefined ? asNullableNumber(body.pontosPorItem) : undefined;
    const bonusConsistencia = body.bonusConsistencia !== undefined ? asNullableNumber(body.bonusConsistencia) : undefined;
    const bonusFinal = body.bonusFinal !== undefined ? asNullableNumber(body.bonusFinal) : undefined;
    const prazoFinal = body.prazoFinal !== undefined ? (body.prazoFinal ? new Date(body.prazoFinal) : null) : undefined;
    const permiteAtraso = body.permiteAtraso !== undefined ? asBool(body.permiteAtraso, true) : undefined;
    const modoExecucao = body.modoExecucao !== undefined ? (body.modoExecucao || null) : undefined;

    if (titulo !== undefined && !titulo) {
      return res.status(400).json({ message: "Título não pode ser vazio." });
    }

    if (
      modoExecucao !== undefined &&
      modoExecucao !== null &&
      !isValidEnumValue(MetodologiaModoExecucao, modoExecucao)
    ) {
      return res.status(400).json({ message: "modoExecucao inválido." });
    }

    const futuraDuracao = duracaoSemanas !== undefined ? duracaoSemanas : estrutura.duracaoSemanas;
    const futuroTreinos = treinosPorSemana !== undefined ? treinosPorSemana : estrutura.treinosPorSemana;

    if (metodologia.estruturaTipo === MetodologiaEstruturaTipo.TRILHA) {
      if (!futuraDuracao || futuraDuracao <= 0) {
        return res.status(400).json({ message: "Trilhas exigem duracaoSemanas válida." });
      }

      if (!futuroTreinos || futuroTreinos <= 0) {
        return res.status(400).json({ message: "Trilhas exigem treinosPorSemana válido." });
      }
    }

    const updated = await prisma.metodologiaEstrutura.update({
      where: { id: estruturaId },
      data: {
        ...(titulo !== undefined ? { titulo } : {}),
        ...(descricao !== undefined ? { descricao } : {}),
        ...(objetivo !== undefined ? { objetivo } : {}),
        ...(ordem !== undefined && ordem !== null ? { ordem } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
        ...(duracaoSemanas !== undefined ? { duracaoSemanas } : {}),
        ...(treinosPorSemana !== undefined ? { treinosPorSemana } : {}),
        ...(quantidadeMinConclusao !== undefined ? { quantidadeMinConclusao } : {}),
        ...(pontosPorItem !== undefined ? { pontosPorItem } : {}),
        ...(bonusConsistencia !== undefined ? { bonusConsistencia } : {}),
        ...(bonusFinal !== undefined ? { bonusFinal } : {}),
        ...(prazoFinal !== undefined ? { prazoFinal } : {}),
        ...(permiteAtraso !== undefined ? { permiteAtraso } : {}),
        ...(modoExecucao !== undefined ? { modoExecucao } : {}),
      },
      include: {
        itens: {
          orderBy: { ordem: "asc" },
        },
      },
    });

    return res.json({ estrutura: updated });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao atualizar estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaEstrutura(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: {
        id: true,
        metodologiaId: true,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.metodologiaProgressoEstrutura.deleteMany({
        where: { estruturaId },
      });

      await tx.metodologiaEstruturaItem.deleteMany({
        where: { estruturaId },
      });

      await tx.metodologiaEstrutura.delete({
        where: { id: estruturaId },
      });
    });

    return res.json({ ok: true, deletedId: estruturaId });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao excluir estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

export async function createMetodologiaEstruturaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: {
        id: true,
        metodologiaId: true,
        tipo: true,
      },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const body = req.body || {};
    const entrada = Array.isArray(body.itens) ? body.itens : [body];

    if (!entrada.length) {
      return res.status(400).json({ message: "Envie ao menos um item." });
    }

    const created = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const item of entrada) {
        const titulo = String(item?.titulo ?? "").trim();
        const descricao = asNullableString(item?.descricao);
        const tipo = item?.tipo;
        const ordemInformada = asNullableNumber(item?.ordem);
        const videoUrl = asNullableString(item?.videoUrl);
        const thumbUrl = asNullableString(item?.thumbUrl);
        const arquivoUrl = asNullableString(item?.arquivoUrl);
        const materialUrl = asNullableString(item?.materialUrl);
        const treinoProgramadoId = asNullableString(item?.treinoProgramadoId);
        const pontos = asNullableNumber(item?.pontos);
        const duracaoMin = asNullableNumber(item?.duracaoMin);
        const obrigatorio = item?.obrigatorio !== undefined ? asBool(item?.obrigatorio, true) : true;
        const publicado = item?.publicado !== undefined ? asBool(item?.publicado, true) : true;

        if (!titulo) {
          throw new Error("Cada item precisa ter título.");
        }

        if (!isValidEnumValue(MetodologiaItemTipo, tipo)) {
          throw new Error(`Tipo de item inválido para "${titulo}".`);
        }

        if ((tipo === MetodologiaItemTipo.VIDEO || tipo === MetodologiaItemTipo.AULA) && !videoUrl) {
          throw new Error(`O item "${titulo}" exige videoUrl.`);
        }

        if (tipo === MetodologiaItemTipo.TREINO && !treinoProgramadoId) {
          throw new Error(`O item "${titulo}" exige treinoProgramadoId.`);
        }

        if (tipo === MetodologiaItemTipo.MATERIAL && !arquivoUrl && !materialUrl) {
          throw new Error(`O item "${titulo}" exige arquivoUrl ou materialUrl.`);
        }

        if (treinoProgramadoId) {
          const treino = await tx.treinoProgramado.findUnique({
            where: { id: treinoProgramadoId },
            select: { id: true },
          });

          if (!treino) {
            throw new Error(`Treino não encontrado para o item "${titulo}".`);
          }
        }

        let ordemFinal = ordemInformada;

        if (!ordemFinal || ordemFinal <= 0) {
          const last = await tx.metodologiaEstruturaItem.findFirst({
            where: { estruturaId },
            orderBy: { ordem: "desc" },
            select: { ordem: true },
          });

          ordemFinal = (last?.ordem ?? 0) + 1;
        }

        const novo = await tx.metodologiaEstruturaItem.create({
          data: {
            estruturaId,
            ordem: ordemFinal,
            titulo,
            descricao,
            tipo,
            videoUrl,
            thumbUrl,
            arquivoUrl,
            materialUrl,
            treinoProgramadoId,
            pontos,
            duracaoMin,
            obrigatorio,
            publicado,
          },
          include: {
            treinoProgramado: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                imagemUrl: true,
                nivel: true,
                categoria: true,
                pontuacao: true,
                duracao: true,
                objetivo: true,
                tipoTreino: true,
              },
            },
          },
        });

        // mantém compatibilidade com tabela legado MetodologiaTreino
        if (tipo === MetodologiaItemTipo.TREINO && treinoProgramadoId) {
          await tx.metodologiaTreino.upsert({
            where: {
              metodologiaId_treinoProgramadoId: {
                metodologiaId,
                treinoProgramadoId,
              },
            },
            update: {},
            create: {
              metodologiaId,
              treinoProgramadoId,
            },
          });
        }

        out.push(novo);
      }

      return out;
    });

    return res.status(201).json({ itens: created });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao criar itens da estrutura.",
      detail: e?.message,
    });
  }
}

export async function deleteMetodologiaEstruturaItens(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { metodologiaId, estruturaId } = req.params;

    const validacao = await validarMetodologiaDoCriador(metodologiaId, userId);
    if (validacao && "erro" in validacao && validacao.erro) {
      return res.status(validacao.erro.status).json({ message: validacao.erro.message });
    }

    const estrutura = await prisma.metodologiaEstrutura.findFirst({
      where: {
        id: estruturaId,
        metodologiaId,
      },
      select: { id: true },
    });

    if (!estrutura) {
      return res.status(404).json({ message: "Estrutura não encontrada." });
    }

    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter(Boolean) : [];

    if (itemIds.length) {
      const deleted = await prisma.metodologiaEstruturaItem.deleteMany({
        where: {
          estruturaId,
          id: { in: itemIds },
        },
      });

      return res.json({
        ok: true,
        deleted: deleted.count,
        mode: "selected",
      });
    }

    const deleted = await prisma.metodologiaEstruturaItem.deleteMany({
      where: { estruturaId },
    });

    return res.json({
      ok: true,
      deleted: deleted.count,
      mode: "all",
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao excluir itens da estrutura.",
      detail: e?.message,
    });
  }
}

export async function concluirEstruturaItemMetodologia(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const { id: metodologiaId, estruturaId } = req.params;
    const itemId = String(req.body?.itemId ?? "").trim();

    if (!itemId) {
      return res.status(400).json({ message: "itemId é obrigatório." });
    }

    const metodologia = await prisma.metodologia.findUnique({
      where: { id: metodologiaId },
      select: {
        id: true,
        ativo: true,
      },
    });

    if (!metodologia || metodologia.ativo === false) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    const assinatura = await prisma.metodologiaAssinante.findUnique({
      where: {
        metodologiaId_usuarioId: {
          metodologiaId,
          usuarioId: userId,
        },
      },
      select: {
        id: true,
        status: true,
        expiraEm: true,
        progresso: true,
      },
    });

    if (!assinatura || assinatura.status === MetodologiaAssinaturaStatus.CANCELADA) {
      return res.status(403).json({ message: "Você não possui acesso a esta metodologia." });
    }

    if (assinatura.expiraEm && new Date(assinatura.expiraEm) <= new Date()) {
      return res.status(403).json({ message: "Sua assinatura desta metodologia expirou." });
    }

    const item = await prisma.metodologiaEstruturaItem.findFirst({
      where: {
        id: itemId,
        estruturaId,
        estrutura: {
          metodologiaId,
        },
      },
      include: {
        estrutura: {
          select: {
            id: true,
            metodologiaId: true,
            titulo: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item da estrutura não encontrado." });
    }

    const [totalItensEstrutura, totalItensConcluidosEstrutura] = await prisma.$transaction(async (tx) => {
      const progressoExistente = await tx.metodologiaProgressoEstrutura.findUnique({
        where: {
          metodologiaAssinanteId_estruturaId: {
            metodologiaAssinanteId: assinatura.id,
            estruturaId,
          },
        },
      });

      const payloadAtual: any =
        progressoExistente?.progresso && typeof progressoExistente.progresso === "object"
          ? { ...(progressoExistente.progresso as any) }
          : {};

      const concluidos: string[] = Array.isArray(payloadAtual.concluidos)
        ? payloadAtual.concluidos.map((v: any) => String(v))
        : [];

      if (!concluidos.includes(itemId)) {
        concluidos.push(itemId);
      }

      const itensPublicados = await tx.metodologiaEstruturaItem.count({
        where: {
          estruturaId,
          publicado: true,
        },
      });

      const statusEstrutura =
        itensPublicados > 0 && concluidos.length >= itensPublicados
          ? MetodologiaProgressoStatus.CONCLUIDA
          : MetodologiaProgressoStatus.EM_ANDAMENTO;

      const pontosGanhos = concluidos.length * ((item.estrutura as any).pontosPorItem ?? 0);

      await tx.metodologiaProgressoEstrutura.upsert({
        where: {
          metodologiaAssinanteId_estruturaId: {
            metodologiaAssinanteId: assinatura.id,
            estruturaId,
          },
        },
        create: {
          metodologiaAssinanteId: assinatura.id,
          estruturaId,
          status: statusEstrutura,
          iniciadoEm: new Date(),
          concluidoEm: statusEstrutura === MetodologiaProgressoStatus.CONCLUIDA ? new Date() : null,
          cicloInicioEm: new Date(),
          itensConcluidos: concluidos.length,
          pontosGanhos,
          ultimoAcessoEm: new Date(),
          progresso: {
            concluidos,
            ultimoItemConcluidoId: itemId,
          } as any,
        },
        update: {
          status: statusEstrutura,
          concluidoEm: statusEstrutura === MetodologiaProgressoStatus.CONCLUIDA ? new Date() : null,
          itensConcluidos: concluidos.length,
          pontosGanhos,
          ultimoAcessoEm: new Date(),
          progresso: {
            concluidos,
            ultimoItemConcluidoId: itemId,
          } as any,
        },
      });

      // mantém compatibilidade com progresso legado da assinatura
      const progressoAssinaturaAtual: any =
        assinatura.progresso && typeof assinatura.progresso === "object"
          ? { ...(assinatura.progresso as any) }
          : {};

      const concluidosLegado: string[] = Array.isArray(progressoAssinaturaAtual.concluidos)
        ? progressoAssinaturaAtual.concluidos.map((v: any) => String(v))
        : [];

      if (!concluidosLegado.includes(itemId)) {
        concluidosLegado.push(itemId);
      }

      progressoAssinaturaAtual.concluidos = concluidosLegado;

      await tx.metodologiaAssinante.update({
        where: { id: assinatura.id },
        data: {
          progresso: progressoAssinaturaAtual,
        },
      });

      return [itensPublicados, concluidos.length] as const;
    });

    await recalcularStatusMetodologiaAssinante(metodologiaId, userId);

    return res.json({
      ok: true,
      estruturaId,
      itemId,
      totalItensEstrutura,
      totalItensConcluidosEstrutura,
      estruturaConcluida: totalItensEstrutura > 0 && totalItensConcluidosEstrutura >= totalItensEstrutura,
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao concluir item da estrutura da metodologia.",
      detail: e?.message,
    });
  }
}

