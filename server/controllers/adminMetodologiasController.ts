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
          _count: { select: { assinantes: true, itens: true } },

          // ✅ Preview: primeiros itens (pra admin bater o olho)
          itens: {
            take: 3,
            orderBy: [{ semana: "asc" }, { ordem: "asc" }],
            select: {
              id: true,
              semana: true,
              ordem: true,
              tipo: true,
              titulo: true,
              videoUrl: true,
              thumbUrl: true,
              duracaoMin: true,
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
        _count: { select: { assinantes: true, itens: true } },
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

        _count: { select: { assinantes: true, itens: true } },

        // ✅ TODOS os itens da metodologia (vídeos/treinos)
        itens: {
          orderBy: [{ semana: "asc" }, { ordem: "asc" }],
          select: {
            id: true,
            semana: true,
            ordem: true,
            titulo: true,
            descricao: true,
            tipo: true,

            // vídeo
            videoUrl: true,
            thumbUrl: true,
            duracaoMin: true,

            // treino
            treinoProgramadoId: true,
            pontos: true,
            publicado: true,

            criadoEm: true,
            atualizadoEm: true,

            // ✅ aqui é o upgrade: traz o treino completo (exercícios + vídeos demonstrativos)
            treinoProgramado: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                descricao: true,
                imagemUrl: true,
                nivel: true,
                categoria: true,
                pontuacao: true,
                duracao: true,
                parceiro: true,
                metodologia: true,
                metas: true,
                dicas: true,
                objetivo: true,
                tipoTreino: true,

                // 🔥 exercícios do treino (join table)
                exercicios: {
                  orderBy: { ordem: "asc" },
                  select: {
                    id: true,
                    ordem: true,
                    repeticoes: true,

                    exercicio: {
                      select: {
                        id: true,
                        codigo: true,
                        nome: true,
                        descricao: true,
                        nivel: true,
                        categorias: true,
                        videoDemonstrativoUrl: true, // ✅ “vídeo do exercício”
                      },
                    },

                    exercicioTemporario: {
                      select: {
                        id: true,
                        codigo: true,
                        nome: true,
                        descricao: true,
                        nivel: true,
                        categorias: true,
                        videoDemonstrativoUrl: true, // ✅ “vídeo do exercício temporário”
                      },
                    },
                  },
                },

                // (opcional) se você quiser mostrar exercícios temporários que existem no treino
                temporarios: {
                  select: {
                    id: true,
                    codigo: true,
                    nome: true,
                    descricao: true,
                    nivel: true,
                    categorias: true,
                    videoDemonstrativoUrl: true,
                  },
                },

                // (opcional) infos do criador do treino
                criadorProfessor: {
                  select: {
                    id: true,
                    nome: true,
                    cref: true,
                    fotoUrl: true,
                    codigo: true,
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