import { Request, Response } from "express";
import { prisma } from "../prisma.js";

function normStr(v: any) {
  return String(v ?? "").trim();
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

    const items = [
      ...learningItems.map((m) => ({ ...m, origemTipo: "LEARNING" })),
      ...avulsaItems.map((m) => ({ ...m, origemTipo: "AVULSA" })),
    ].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    return res.json({ items: pagedItems, total, page, pageSize });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias pendentes.", detail: e?.message });
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
    return res.status(500).json({
      message: "Erro ao atualizar status (ativo) da metodologia.",
      detail: e?.message,
    });
  }
}

export async function getMetodologiaPendenteDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const origemTipo = String(req.query.origemTipo || "LEARNING").toUpperCase();

    if (origemTipo === "AVULSA") {
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
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao buscar detalhe da metodologia.",
      detail: e?.message,
    });
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

    const allItems = [
      ...learningItems.map((m) => ({
        ...m,
        origemTipo: "LEARNING" as const,
      })),
      ...avulsaItems.map((m) => ({
        ...m,
        origemTipo: "AVULSA" as const,
      })),
    ].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return res.json({ items, total, page, pageSize });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao listar minhas metodologias do admin.",
      detail: e?.message,
    });
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
    return res.status(500).json({
      message: "Erro ao apagar metodologia do admin.",
      detail: e?.message,
    });
  }
}