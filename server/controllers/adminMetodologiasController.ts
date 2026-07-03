import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";

function normStr(v: any) {
  return String(v ?? "").trim();
}

async function anexarCountsEstruturaPorMetodologia(ids: string[]) {
  const out: Record<
    string,
    {
      treinoCount: number;
      videoCount: number;
      aulaCount: number;
      aulaAoVivoCount: number;
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
      aulaAoVivoCount: 0,
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

    if (it.tipo === "TREINO") out[metodologiaId].treinoCount++;
    if (it.tipo === "VIDEO") out[metodologiaId].videoCount++;
    if (it.tipo === "AULA") out[metodologiaId].aulaCount++;
    if (it.tipo === "AULA_AO_VIVO") out[metodologiaId].aulaAoVivoCount++;
    if (it.tipo === "MATERIAL") out[metodologiaId].materialCount++;
    if (it.tipo === "DESAFIO") out[metodologiaId].desafioCount++;
  }

  return out;
}

export async function listMetodologiasPendentes(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
    const q = normStr(req.query.q).toLowerCase();

    const whereLearning: any = { ativo: false };
    const whereAvulsa: any = { ativo: false };

    if (q) {
      const filtros = [
        { titulo: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
        { criadorUsuario: { is: { nome: { contains: q, mode: "insensitive" } } } },
        { criadorUsuario: { is: { nomeDeUsuario: { contains: q, mode: "insensitive" } } } },
        { criadorUsuario: { is: { email: { contains: q, mode: "insensitive" } } } },
      ];

      whereLearning.OR = filtros;
      whereAvulsa.OR = filtros;
    }

    const [learningItems, avulsaItems] = await Promise.all([
      prisma.metodologia.findMany({
        where: whereLearning,
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: {
            select: { id: true, nome: true, nomeDeUsuario: true, email: true, foto: true, parceiro: true },
          },
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            take: 2,
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                take: 3,
                orderBy: { ordem: "asc" },
                select: {
                  id: true,
                  ordem: true,
                  tipo: true,
                  titulo: true,
                  videoUrl: true,
                  thumbUrl: true,
                  arquivoUrl: true,
                  materialUrl: true,
                  treinoProgramadoId: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.metodologiaAvulsa.findMany({
        where: whereAvulsa,
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: {
            select: { id: true, nome: true, nomeDeUsuario: true, email: true, foto: true, parceiro: true },
          },
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            take: 2,
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                take: 3,
                orderBy: { ordem: "asc" },
                select: {
                  id: true,
                  ordem: true,
                  tipo: true,
                  titulo: true,
                  videoUrl: true,
                  thumbUrl: true,
                  arquivoUrl: true,
                  materialUrl: true,
                  treinoProgramadoId: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const learningIds = learningItems.map((m) => m.id);
    const learningCountsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const items = [
      ...learningItems.map((m) => ({
        ...m,
        origemTipo: "LEARNING",
        videoCount: learningCountsById[m.id]?.videoCount ?? 0,
        aulaCount: learningCountsById[m.id]?.aulaCount ?? 0,
        aulaAoVivoCount: learningCountsById[m.id]?.aulaAoVivoCount ?? 0,
        aulasAoVivoCount: learningCountsById[m.id]?.aulaAoVivoCount ?? 0,
        treinoCount: learningCountsById[m.id]?.treinoCount ?? 0,
        materialCount: learningCountsById[m.id]?.materialCount ?? 0,
        desafioCount: learningCountsById[m.id]?.desafioCount ?? 0,
        estruturaCount: learningCountsById[m.id]?.estruturaCount ?? 0,
      })),
      ...avulsaItems.map((m) => {
        const itens = (m.estruturas || []).flatMap((e: any) => e.itens || []);
        return {
          ...m,
          origemTipo: "AVULSA",
          videoCount: itens.filter((it: any) => it.tipo === "VIDEO").length,
          aulaCount: itens.filter((it: any) => it.tipo === "AULA").length,
          aulaAoVivoCount: itens.filter((it: any) => it.tipo === "AULA_AO_VIVO").length,
          aulasAoVivoCount: itens.filter((it: any) => it.tipo === "AULA_AO_VIVO").length,
          treinoCount: itens.filter((it: any) => it.tipo === "TREINO").length,
          materialCount: itens.filter((it: any) => it.tipo === "MATERIAL").length,
          desafioCount: itens.filter((it: any) => it.tipo === "DESAFIO").length,
          estruturaCount: (m.estruturas || []).length,
          _count: {
            ...(m as any)._count,
            estruturas: (m.estruturas || []).length,
          },
        };
      }),
    ].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    return res.json({ items: pagedItems, total, page, pageSize });
  } catch (e: any) {
    return sendError(res, e, "Erro ao listar metodologias pendentes.");
  }
}

export async function setMetodologiaAtivo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { ativo, origemTipo } = req.body || {};

    if (typeof ativo !== "boolean") {
      return res.status(400).json({ message: "Campo 'ativo' deve ser boolean." });
    }

    const origem = String(origemTipo || "LEARNING").toUpperCase();

    if (origem === "AVULSA") {
      const exists = await prisma.metodologiaAvulsa.findUnique({ where: { id } });
      if (!exists) return res.status(404).json({ message: "Metodologia avulsa não encontrada." });

      const updated = await prisma.metodologiaAvulsa.update({
        where: { id },
        data: { ativo },
        include: {
          criadorUsuario: {
            select: { id: true, nome: true, nomeDeUsuario: true, email: true, foto: true, parceiro: true },
          },
          estruturas: {
            include: { itens: true },
          },
        },
      });

      return res.json({ item: updated });
    }

    const exists = await prisma.metodologia.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Metodologia não encontrada." });

    const updated = await prisma.metodologia.update({
      where: { id },
      data: { ativo },
      include: {
        criadorUsuario: {
          select: { id: true, nome: true, nomeDeUsuario: true, email: true, foto: true, parceiro: true },
        },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return sendError(res, e, "Erro ao atualizar status (ativo) da metodologia.");
  }
}

export async function getMetodologiaPendenteDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const origemTipo = String(req.query.origemTipo || "LEARNING").toUpperCase();
    const userId = (req as any).user?.id || (req as any).userId || null;

    const isAvulsa = origemTipo === "AVULSA";

    const assinatura = userId
      ? isAvulsa
        ? await prisma.metodologiaAssinante.findFirst({
            where: {
              metodologiaAvulsaId: id,
              usuarioId: userId,
            },
            select: {
              id: true,
              status: true,
              expiraEm: true,
              iniciouEm: true,
              concluiuEm: true,
              origem: true,
              progresso: true,
            },
          })
        : await prisma.metodologiaAssinante.findUnique({
            where: {
              metodologiaId_usuarioId: {
                metodologiaId: id,
                usuarioId: userId,
              },
            },
            select: {
              id: true,
              status: true,
              expiraEm: true,
              iniciouEm: true,
              concluiuEm: true,
              origem: true,
              progresso: true,
            },
          })
      : null;

    const progressoEstruturas =
      assinatura?.id && !isAvulsa
        ? await prisma.metodologiaProgressoEstrutura.findMany({
            where: {
              metodologiaAssinanteId: assinatura.id,
            },
            select: {
              progresso: true,
            },
          })
        : [];

    const concluidosAssinatura = Array.isArray((assinatura as any)?.progresso?.concluidos)
      ? (assinatura as any).progresso.concluidos.map((v: any) => String(v))
      : [];

    const concluidosEstruturas = progressoEstruturas.flatMap((p: any) =>
      Array.isArray(p?.progresso?.concluidos)
        ? p.progresso.concluidos.map((v: any) => String(v))
        : []
    );

    const concluidosSubmissoes = userId
      ? isAvulsa
        ? await (prisma as any).metodologiaItemSubmissao.findMany({
            where: {
              metodologiaAvulsaId: id,
              usuarioId: userId,
            },
            select: { itemAvulsaId: true },
          })
        : await (prisma as any).metodologiaItemSubmissao.findMany({
            where: {
              metodologiaId: id,
              usuarioId: userId,
            },
            select: { itemId: true },
          })
      : [];

    const concluidosSubmissoesIds = isAvulsa
      ? concluidosSubmissoes
          .map((c: any) => c?.itemAvulsaId)
          .filter(Boolean)
          .map((v: any) => String(v))
      : concluidosSubmissoes
          .map((c: any) => c?.itemId)
          .filter(Boolean)
          .map((v: any) => String(v));

    const concluidosIds = Array.from(
      new Set<string>([
        ...concluidosAssinatura,
        ...concluidosEstruturas,
        ...concluidosSubmissoesIds,
      ])
    );

    const minhaAvaliacao = userId
      ? isAvulsa
        ? await prisma.avaliacaoMetodologia.findFirst({
            where: {
              usuarioId: userId,
              metodologiaAvulsaId: id,
            },
            select: {
              nota: true,
              comentario: true,
              updatedAt: true,
            },
          })
        : await prisma.avaliacaoMetodologia.findUnique({
            where: {
              metodologiaId_usuarioId: {
                metodologiaId: id,
                usuarioId: userId,
              },
            },
            select: {
              nota: true,
              comentario: true,
              updatedAt: true,
            },
          })
      : null;

    if (isAvulsa) {
      const item = await prisma.metodologiaAvulsa.findUnique({
        where: { id },
        include: {
          criadorUsuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              foto: true,
              parceiro: true,
            },
          },
          estruturas: {
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                orderBy: { ordem: "asc" },
                select: {
                  id: true,
                  ordem: true,
                  tipo: true,
                  titulo: true,
                  descricao: true,
                  videoUrl: true,
                  thumbUrl: true,
                  arquivoUrl: true,
                  materialUrl: true,
                  duracaoMin: true,
                  pontos: true,
                  obrigatorio: true,
                  publicado: true,
                  treinoProgramadoId: true,
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
        },
      });

      if (!item) {
        return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
      }

      return res.json({
        item: {
          ...item,
          origemTipo: "AVULSA",
          viewer: {
            isAssinante: true,
            temAcesso: true,
            assinaturaTipo: "AVULSA",
            expiraEm: assinatura?.expiraEm
              ? new Date(assinatura.expiraEm).toISOString()
              : null,
            podeAssinarAgora: false,
            podeAvaliar:
              !!userId &&
              !minhaAvaliacao &&
              (Boolean(assinatura?.concluiuEm) || concluidosIds.length > 0),
            minhaAvaliacao: minhaAvaliacao
              ? {
                  nota: minhaAvaliacao.nota,
                  comentario: minhaAvaliacao.comentario,
                  updatedAt: minhaAvaliacao.updatedAt.toISOString(),
                }
              : null,
            motivoBloqueio: null,
            progresso: {
              concluidos: concluidosIds,
            },
            status: assinatura?.status ?? null,
            concluiuEm: assinatura?.concluiuEm
              ? new Date(assinatura.concluiuEm).toISOString()
              : null,
          },
        },
      });
    }

    const item = await prisma.metodologia.findUnique({
      where: { id },
      include: {
        criadorUsuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            foto: true,
            parceiro: true,
          },
        },
        _count: { select: { assinantes: true, estruturas: true } },
        estruturas: {
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              orderBy: { ordem: "asc" },
              select: {
                id: true,
                ordem: true,
                tipo: true,
                titulo: true,
                descricao: true,
                videoUrl: true,
                thumbUrl: true,
                arquivoUrl: true,
                materialUrl: true,
                duracaoMin: true,
                pontos: true,
                obrigatorio: true,
                publicado: true,
                treinoProgramadoId: true,
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
        MetodologiaTreino: {
          orderBy: { criadoEm: "desc" },
          include: {
            treino: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                imagemUrl: true,
                nivel: true,
                categoria: true,
                pontuacao: true,
                duracao: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    return res.json({
      item: {
        ...item,
        origemTipo: "LEARNING",
        viewer: {
          isAssinante: true,
          temAcesso: true,
          assinaturaTipo: "LEARNING",
          expiraEm: assinatura?.expiraEm
            ? new Date(assinatura.expiraEm).toISOString()
            : null,
          podeAssinarAgora: false,
          podeAvaliar:
            !!userId &&
            !minhaAvaliacao &&
            (Boolean(assinatura?.concluiuEm) || concluidosIds.length > 0),
          minhaAvaliacao: minhaAvaliacao
            ? {
                nota: minhaAvaliacao.nota,
                comentario: minhaAvaliacao.comentario,
                updatedAt: minhaAvaliacao.updatedAt.toISOString(),
              }
            : null,
          motivoBloqueio: null,
          progresso: {
            concluidos: concluidosIds,
          },
          status: assinatura?.status ?? null,
          concluiuEm: assinatura?.concluiuEm
            ? new Date(assinatura.concluiuEm).toISOString()
            : null,
        },
      },
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao buscar detalhe da metodologia.");
  }
}

export async function listMinhasMetodologiasAdmin(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
    const q = normStr(req.query.q).toLowerCase();

    const whereLearning: any = {
      criadorUsuarioId: userId,
    };

    const whereAvulsa: any = {
      criadorUsuarioId: userId,
    };

    if (q) {
      const filtros = [
        { titulo: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
      ];

      whereLearning.OR = filtros;
      whereAvulsa.OR = filtros;
    }

    const [learningItems, avulsaItems] = await Promise.all([
      prisma.metodologia.findMany({
        where: whereLearning,
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              foto: true,
              parceiro: true,
            },
          },
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            take: 2,
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                take: 3,
                orderBy: { ordem: "asc" },
                select: {
                  id: true,
                  ordem: true,
                  tipo: true,
                  titulo: true,
                  videoUrl: true,
                  thumbUrl: true,
                  arquivoUrl: true,
                  materialUrl: true,
                  treinoProgramadoId: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      }),

      prisma.metodologiaAvulsa.findMany({
        where: whereAvulsa,
        orderBy: { criadoEm: "desc" },
        include: {
          criadorUsuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              email: true,
              foto: true,
              parceiro: true,
            },
          },
          _count: { select: { assinantes: true, estruturas: true } },
          estruturas: {
            take: 2,
            orderBy: { ordem: "asc" },
            include: {
              itens: {
                take: 3,
                orderBy: { ordem: "asc" },
                select: {
                  id: true,
                  ordem: true,
                  tipo: true,
                  titulo: true,
                  videoUrl: true,
                  thumbUrl: true,
                  arquivoUrl: true,
                  materialUrl: true,
                  treinoProgramadoId: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const learningIds = learningItems.map((m) => m.id);
    const learningCountsById = await anexarCountsEstruturaPorMetodologia(learningIds);

    const allItems = [
      ...learningItems.map((m) => ({
        ...m,
        origemTipo: "LEARNING" as const,
        videoCount: learningCountsById[m.id]?.videoCount ?? 0,
        aulaCount: learningCountsById[m.id]?.aulaCount ?? 0,
        aulaAoVivoCount: learningCountsById[m.id]?.aulaAoVivoCount ?? 0,
        aulasAoVivoCount: learningCountsById[m.id]?.aulaAoVivoCount ?? 0,
        treinoCount: learningCountsById[m.id]?.treinoCount ?? 0,
        materialCount: learningCountsById[m.id]?.materialCount ?? 0,
        desafioCount: learningCountsById[m.id]?.desafioCount ?? 0,
        estruturaCount: learningCountsById[m.id]?.estruturaCount ?? 0,
      })),
      ...avulsaItems.map((m) => {
        const itens = (m.estruturas || []).flatMap((e: any) => e.itens || []);
        return {
          ...m,
          origemTipo: "AVULSA" as const,
          videoCount: itens.filter((it: any) => it.tipo === "VIDEO").length,
          aulaCount: itens.filter((it: any) => it.tipo === "AULA").length,
          aulaAoVivoCount: itens.filter((it: any) => it.tipo === "AULA_AO_VIVO").length,
          aulasAoVivoCount: itens.filter((it: any) => it.tipo === "AULA_AO_VIVO").length,
          treinoCount: itens.filter((it: any) => it.tipo === "TREINO").length,
          materialCount: itens.filter((it: any) => it.tipo === "MATERIAL").length,
          desafioCount: itens.filter((it: any) => it.tipo === "DESAFIO").length,
          estruturaCount: (m.estruturas || []).length,
          _count: {
            ...(m as any)._count,
            estruturas: (m.estruturas || []).length,
          },
        };
      })
    ].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return res.json({ items, total, page, pageSize });
  } catch (e: any) {
    return sendError(res, e, "Erro ao listar minhas metodologias do admin.");
  }
}

export async function deleteMinhaMetodologiaAdmin(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const { id } = req.params;
    const origemTipo = String(req.query.origemTipo || req.body?.origemTipo || "LEARNING").toUpperCase();

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    if (origemTipo === "AVULSA") {
      const metodologiaAvulsa = await prisma.metodologiaAvulsa.findUnique({
        where: { id },
        select: {
          id: true,
          criadorUsuarioId: true,
        },
      });

      if (!metodologiaAvulsa) {
        return res.status(404).json({ message: "Metodologia avulsa não encontrada." });
      }

      if (String(metodologiaAvulsa.criadorUsuarioId) !== String(userId)) {
        return res.status(403).json({
          message: "Você só pode apagar metodologias criadas por você.",
        });
      }

      await prisma.metodologiaAvulsa.delete({
        where: { id },
      });

      return res.json({ ok: true });
    }

    const metodologia = await prisma.metodologia.findUnique({
      where: { id },
      select: {
        id: true,
        criadorUsuarioId: true,
      },
    });

    if (!metodologia) {
      return res.status(404).json({ message: "Metodologia não encontrada." });
    }

    if (String(metodologia.criadorUsuarioId) !== String(userId)) {
      return res.status(403).json({
        message: "Você só pode apagar metodologias criadas por você.",
      });
    }

    await prisma.metodologia.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return sendError(res, e, "Erro ao apagar metodologia do admin.");
  }
}