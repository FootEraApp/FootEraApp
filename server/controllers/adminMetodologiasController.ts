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

    const where: any = { ativo: false };

    if (q) {
      where.OR = [
        { titulo: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
        { criadorUsuario: { is: { nome: { contains: q, mode: "insensitive" } } } },
        { criadorUsuario: { is: { nomeDeUsuario: { contains: q, mode: "insensitive" } } } },
        { criadorUsuario: { is: { email: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.metodologia.count({ where }),
      prisma.metodologia.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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

    return res.json({ items, total, page, pageSize });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao listar metodologias pendentes.", detail: e?.message });
  }
}

export async function setMetodologiaAtivo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { ativo } = req.body || {};

    if (typeof ativo !== "boolean") {
      return res.status(400).json({ message: "Campo 'ativo' deve ser boolean." });
    }

    const exists = await prisma.metodologia.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Metodologia não encontrada." });

    const updated = await prisma.metodologia.update({
      where: { id },
      data: { ativo },
      include: {
        criadorUsuario: { select: { id: true, nome: true, nomeDeUsuario: true, email: true, foto: true, parceiro: true } },
        _count: { select: { assinantes: true, estruturas: true } },
      },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ message: "Erro ao atualizar status (ativo) da metodologia.", detail: e?.message });
  }
}

export async function getMetodologiaPendenteDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;

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

        // ✅ Treinos vinculados pela tabela MetodologiaTreino (opcional, mas útil)
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

    if (!item) return res.status(404).json({ message: "Metodologia não encontrada." });

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({
      message: "Erro ao buscar detalhe da metodologia.",
      detail: e?.message,
    });
  }
}