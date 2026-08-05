import { Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { TipoMembro, NotificacaoTipo } from "@prisma/client";
import { getIO } from "../socket.js";
import { criarNotificacaoEEnviarPush } from "./notificacoesController.js";

async function buscarNomeUsuario(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      nome: true,
      nomeDeUsuario: true,
    },
  });

  return (
    usuario?.nome?.trim() ||
    usuario?.nomeDeUsuario?.trim() ||
    "Um usuário"
  );
}

async function getIdsPermitidosParaAdicionarNoGrupo(grupoId: string, userId: string) {
  const membrosAdmins = await prisma.membroGrupo.findMany({
    where: {
      grupoId,
      tipo: TipoMembro.ADMIN,
    },
    select: {
      usuarioId: true,
    },
  });

  const adminIds = Array.from(new Set(membrosAdmins.map((m) => m.usuarioId)));
  const baseIds = Array.from(new Set([userId, ...adminIds]));

  const seguindo = await prisma.seguidor.findMany({
    where: {
      seguidorUsuarioId: { in: baseIds },
    },
    select: {
      seguidoUsuarioId: true,
    },
  });

  return new Set(
    seguindo
      .map((s) => s.seguidoUsuarioId)
      .filter((id) => !!id && !baseIds.includes(id))
  );
}

export async function listarUsuariosAdicionaveisNoGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId } = req.params as { grupoId: string };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const meuMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });

    if (!meuMembro || meuMembro.tipo !== TipoMembro.ADMIN) {
      return res.status(403).json({ error: "Apenas administradores podem ver usuários adicionáveis." });
    }

    const idsPermitidos = await getIdsPermitidosParaAdicionarNoGrupo(grupoId, userId);

    const membrosAtuais = await prisma.membroGrupo.findMany({
      where: { grupoId },
      select: { usuarioId: true },
    });

    const membrosSet = new Set(membrosAtuais.map((m) => m.usuarioId));

    const idsFiltrados = Array.from(idsPermitidos).filter(
      (id) => !!id && !membrosSet.has(id)
    );

    if (idsFiltrados.length === 0) {
      return res.json([]);
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        id: { in: idsFiltrados },
      },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        foto: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    return res.json(
      usuarios.map((u) => ({
        id: u.id,
        nome: u.nome || u.nomeDeUsuario || "Usuário FootEra",
        foto: u.foto,
      }))
    );
  } catch (error) {
    console.error("Erro ao listar usuários adicionáveis no grupo:", error);
    return res.status(500).json({ error: "Erro ao listar usuários adicionáveis no grupo" });
  }
}

export async function criarGrupo(
  req: AuthenticatedRequest,
  res: Response
) {
  const { nome, descricao, membros } = req.body as {
    nome: string;
    descricao?: string;
    membros: string[];
  };

  const ownerId = req.userId;

  if (!ownerId) {
    return res.status(401).json({
      error: "Não autenticado",
    });
  }

  if (!nome?.trim() || !Array.isArray(membros)) {
    return res.status(400).json({
      error: "Nome e lista de membros são obrigatórios",
    });
  }

  try {
    const membrosUnicos = Array.from(new Set(membros)).filter(
      (id) => id && id !== ownerId
    );

    const grupo = await prisma.grupo.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        ownerId,
        membros: {
          create: [
            {
              usuarioId: ownerId,
              tipo: TipoMembro.ADMIN,
            },
            ...membrosUnicos.map((uid) => ({
              usuarioId: uid,
              tipo: TipoMembro.MEMBRO,
            })),
          ],
        },
      },
      include: {
        owner: true,
        membros: {
          include: {
            usuario: true,
          },
        },
      },
    });

    const grupoParaLista = {
      id: grupo.id,
      nome: grupo.nome,
      descricao: grupo.descricao,
      ownerId: grupo.ownerId,
      totalMembros: grupo.membros.length,
      ultimaMensagem: null,
      ultimaMensagemTipo: null,
      ultimaMensagemEm: null,
    };

    const participantesIds = Array.from(
      new Set(grupo.membros.map((membro) => membro.usuarioId))
    );

    const nomeCriador =
      grupo.owner?.nome?.trim() ||
      grupo.owner?.nomeDeUsuario?.trim() ||
      "Um usuário";

    const resultadosNotificacoes = await Promise.allSettled(
      membrosUnicos.map((membroId) =>
        criarNotificacaoEEnviarPush({
          usuarioId: membroId,
          actorId: ownerId,
          tipo: NotificacaoTipo.MENSAGEM,
          titulo: "Você foi adicionado a um grupo",
          mensagem: `${nomeCriador} adicionou você ao grupo ${grupo.nome}.`,
          link: `/mensagens?grupoId=${grupo.id}`,
        })
      )
    );

    resultadosNotificacoes.forEach((resultado, index) => {
      if (resultado.status === "rejected") {
        console.warn(
          "[criarGrupo] falha ao notificar membro:",
          {
            membroId: membrosUnicos[index],
            erro: resultado.reason,
          }
        );
      }
    });

    const io = getIO();

    if (io) {
      participantesIds.forEach((participanteId) => {
        io.to(`u:${participanteId}`).emit(
          "grupoCriado",
          grupoParaLista
        );
      });
    }

    return res.status(201).json(grupo);
  } catch (error) {
    console.error("Erro ao criar grupo:", error);

    return res.status(500).json({
      error: "Erro ao criar grupo",
    });
  }
}

export async function listarMeusGrupos(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const grupos = await prisma.grupo.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { membros: { some: { usuarioId: userId } } },
        ],
      },
      include: {
        _count: { select: { membros: true } },
        membros: {
          take: 5,
          include: { usuario: { select: { id: true, nome: true, foto: true } } },
        },
        mensagens: {
          take: 1,
          orderBy: { criadaEm: "desc" },
          select: {
            conteudo: true,
            tipo: true,
            criadaEm: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const payload = grupos.map(g => ({
      id: g.id,
      nome: g.nome,
      descricao: g.descricao,
      ownerId: g.ownerId,
      totalMembros: g._count.membros,
      membrosPreview: g.membros.map(m => m.usuario),
      ultimaMensagem: g.mensagens[0]?.conteudo ?? null,
      ultimaMensagemTipo: g.mensagens[0]?.tipo ?? null,
      ultimaMensagemEm: g.mensagens[0]?.criadaEm ?? null,
    }));

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
}

export async function detalharGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId } = req.params as { grupoId: string };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const membroAtual = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });

    if (!membroAtual) {
      return res.status(403).json({ error: "Você não participa deste grupo." });
    }

    const grupo = await prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        membros: {
          orderBy: { criadoEm: "asc" },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeDeUsuario: true,
                foto: true,
              },
            },
          },
        },
      },
    });

    if (!grupo) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    return res.json({
      id: grupo.id,
      nome: grupo.nome,
      descricao: grupo.descricao,
      ownerId: grupo.ownerId,
      meuTipo: membroAtual.tipo,
      membros: grupo.membros.map((m) => ({
        id: m.usuario.id,
        nome: m.usuario.nome || m.usuario.nomeDeUsuario || "Usuário FootEra",
        foto: m.usuario.foto,
        tipo: m.tipo,
        isOwner: grupo.ownerId === m.usuarioId,
      })),
    });
  } catch (error) {
    console.error("Erro ao detalhar grupo:", error);
    return res.status(500).json({ error: "Erro ao detalhar grupo" });
  }
}

export async function adicionarMembrosGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId } = req.params as { grupoId: string };
  const { membros } = req.body as { membros: string[] };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });
  if (!Array.isArray(membros) || membros.length === 0) {
    return res.status(400).json({ error: "Lista de membros inválida." });
  }

  try {
    const meuMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });

    if (!meuMembro || meuMembro.tipo !== TipoMembro.ADMIN) {
      return res.status(403).json({ error: "Apenas administradores podem adicionar membros." });
    }

    const idsPermitidos = await getIdsPermitidosParaAdicionarNoGrupo(grupoId, userId);

    const membrosUnicos = Array.from(new Set(membros))
      .filter((id) => !!id && id !== userId && idsPermitidos.has(id));

    const jaExistentes = await prisma.membroGrupo.findMany({
      where: {
        grupoId,
        usuarioId: { in: membrosUnicos },
      },
      select: { usuarioId: true },
    });

    const existentesSet = new Set(jaExistentes.map((m) => m.usuarioId));
    const novos = membrosUnicos.filter((id) => !existentesSet.has(id));

    if (novos.length > 0) {
      await prisma.membroGrupo.createMany({
        data: novos.map((usuarioId) => ({
          grupoId,
          usuarioId,
          tipo: TipoMembro.MEMBRO,
        })),
        skipDuplicates: true,
      });

      const [grupo, nomeAdministrador] = await Promise.all([
        prisma.grupo.findUnique({
          where: {
            id: grupoId,
          },
          include: {
            _count: {
              select: {
                membros: true,
              },
            },
            mensagens: {
              take: 1,
              orderBy: {
                criadaEm: "desc",
              },
              select: {
                conteudo: true,
                tipo: true,
                criadaEm: true,
              },
            },
          },
        }),

        buscarNomeUsuario(userId),
      ]);

      if (grupo) {
        const resultadosNotificacoes = await Promise.allSettled(
          novos.map((novoMembroId) =>
            criarNotificacaoEEnviarPush({
              usuarioId: novoMembroId,
              actorId: userId,
              tipo: NotificacaoTipo.MENSAGEM,
              titulo: "Você foi adicionado a um grupo",
              mensagem:
                `${nomeAdministrador} adicionou você ao grupo ${grupo.nome}.`,
              link: `/mensagens?grupoId=${grupoId}`,
            })
          )
        );

        resultadosNotificacoes.forEach((resultado, index) => {
          if (resultado.status === "rejected") {
            console.warn(
              "[adicionarMembrosGrupo] falha ao notificar membro:",
              {
                membroId: novos[index],
                erro: resultado.reason,
              }
            );
          }
        });

        const grupoParaLista = {
          id: grupo.id,
          nome: grupo.nome,
          descricao: grupo.descricao,
          ownerId: grupo.ownerId,
          totalMembros: grupo._count.membros,
          ultimaMensagem: grupo.mensagens[0]?.conteudo ?? null,
          ultimaMensagemTipo: grupo.mensagens[0]?.tipo ?? null,
          ultimaMensagemEm: grupo.mensagens[0]?.criadaEm ?? null,
        };

        const io = getIO();

        if (io) {
          novos.forEach((novoMembroId) => {
            io.to(`u:${novoMembroId}`).emit(
              "grupoCriado",
              grupoParaLista
            );
          });
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao adicionar membros no grupo:", error);
    return res.status(500).json({ error: "Erro ao adicionar membros no grupo" });
  }
}

export async function alterarTipoMembroGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId, membroId } = req.params as { grupoId: string; membroId: string };
  const { tipo } = req.body as { tipo: "ADMIN" | "MEMBRO" };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });
  if (!["ADMIN", "MEMBRO"].includes(String(tipo))) {
    return res.status(400).json({ error: "Tipo inválido." });
  }

  try {
    const meuMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });

    if (!meuMembro || meuMembro.tipo !== TipoMembro.ADMIN) {
      return res.status(403).json({ error: "Apenas administradores podem alterar permissões." });
    }

    const grupo = await prisma.grupo.findUnique({
      where: {
        id: grupoId,
      },
      select: {
        ownerId: true,
        nome: true,
      },
    });

    if (!grupo) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    if (grupo.ownerId === membroId && tipo !== "ADMIN") {
      return res.status(400).json({ error: "O dono do grupo deve permanecer como admin." });
    }

    const membro = await prisma.membroGrupo.findUnique({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: membroId,
        },
      },
    });

    if (!membro) {
      return res.status(404).json({ error: "Membro não encontrado no grupo." });
    }

    const tipoAnterior = membro.tipo;

    await prisma.membroGrupo.update({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: membroId,
        },
      },
      data: {
        tipo:
          tipo === "ADMIN"
            ? TipoMembro.ADMIN
            : TipoMembro.MEMBRO,
      },
    });

    const foiPromovidoAAdministrador =
      tipo === "ADMIN" &&
      tipoAnterior !== TipoMembro.ADMIN;

    if (foiPromovidoAAdministrador) {
      try {
        const nomeResponsavel = await buscarNomeUsuario(userId);

        await criarNotificacaoEEnviarPush({
          usuarioId: membroId,
          actorId: userId,
          tipo: NotificacaoTipo.MENSAGEM,
          titulo: "Você agora é administrador",
          mensagem:
            `${nomeResponsavel} tornou você administrador do grupo ${grupo.nome}.`,
          link: `/mensagens?grupoId=${grupoId}`,
        });
      } catch (error) {
        console.warn(
          "[alterarTipoMembroGrupo] falha ao enviar notificação:",
          error
        );
      }
    }

    return res.status(200).json({
      ok: true,
      tipo:
        tipo === "ADMIN"
          ? TipoMembro.ADMIN
          : TipoMembro.MEMBRO,
    });
  } catch (error) {
    console.error("Erro ao alterar tipo do membro:", error);
    return res.status(500).json({ error: "Erro ao alterar tipo do membro." });
  }
}

export async function removerMembroGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId, membroId } = req.params as { grupoId: string; membroId: string };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const meuMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });

    if (!meuMembro || meuMembro.tipo !== TipoMembro.ADMIN) {
      return res.status(403).json({ error: "Apenas administradores podem remover membros." });
    }

    const grupo = await prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { ownerId: true },
    });

    if (!grupo) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    if (grupo.ownerId === membroId) {
      return res.status(400).json({ error: "O dono do grupo não pode ser removido por esta ação." });
    }

    await prisma.membroGrupo.delete({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: membroId,
        },
      },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao remover membro do grupo:", error);
    return res.status(500).json({ error: "Erro ao remover membro do grupo" });
  }
}

export async function sairDoGrupo(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  const { grupoId } = req.params as { grupoId: string };

  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const grupo = await prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { ownerId: true },
    });

    if (!grupo) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    const meuMembro = await prisma.membroGrupo.findUnique({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: userId,
        },
      },
    });

    if (!meuMembro) {
      return res.status(404).json({ error: "Você não participa deste grupo." });
    }

    if (grupo.ownerId === userId) {
      const outrosAdmins = await prisma.membroGrupo.findMany({
        where: {
          grupoId,
          tipo: TipoMembro.ADMIN,
          usuarioId: { not: userId },
        },
        select: { usuarioId: true },
      });

      if (outrosAdmins.length === 0) {
        return res.status(400).json({
          error: "O administrador/dono não pode sair do grupo sem existir outro admin.",
        });
      }

      const novoOwnerId = outrosAdmins[0].usuarioId;

      await prisma.$transaction([
        prisma.grupo.update({
          where: { id: grupoId },
          data: { ownerId: novoOwnerId },
        }),
        prisma.membroGrupo.delete({
          where: {
            grupoId_usuarioId: {
              grupoId,
              usuarioId: userId,
            },
          },
        }),
      ]);

      const io = getIO();

      if (io) {
        io.to(`u:${userId}`).emit("grupoRemovido", {
          grupoId,
          motivo: "SAIU",
        });
      }

      return res.status(200).json({ ok: true, transferiuOwnerPara: novoOwnerId });
    }

    await prisma.membroGrupo.delete({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: userId,
        },
      },
    });

    const io = getIO();

    if (io) {
      io.to(`u:${userId}`).emit("grupoRemovido", {
        grupoId,
        motivo: "SAIU",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao sair do grupo:", error);
    return res.status(500).json({ error: "Erro ao sair do grupo" });
  }
}

export async function deletarGrupo(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.userId;
  const { grupoId } = req.params as { grupoId: string };

  if (!userId) {
    return res.status(401).json({
      error: "Não autenticado",
    });
  }

  try {
    const grupo = await prisma.grupo.findUnique({
      where: {
        id: grupoId,
      },
      select: {
        id: true,
        nome: true,
        ownerId: true,
        membros: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

    if (!grupo) {
      return res.status(404).json({
        error: "Grupo não encontrado.",
      });
    }

    if (grupo.ownerId !== userId) {
      return res.status(403).json({
        error: "Apenas o dono pode apagar este grupo.",
      });
    }

    const participantesIds = Array.from(
      new Set([
        grupo.ownerId,
        ...grupo.membros.map((membro) => membro.usuarioId),
      ])
    );

    await prisma.$transaction(async (tx) => {
      const desafios = await tx.desafioEmGrupo.findMany({
        where: {
          grupoId,
        },
        select: {
          id: true,
        },
      });

      const desafiosIds = desafios.map((desafio) => desafio.id);

      await tx.mensagemGrupo.deleteMany({
        where: {
          grupoId,
        },
      });

      if (desafiosIds.length > 0) {
        await tx.submissaoDesafioEmGrupo.deleteMany({
          where: {
            desafioEmGrupoId: {
              in: desafiosIds,
            },
          },
        });

        await tx.desafioEmGrupo.deleteMany({
          where: {
            id: {
              in: desafiosIds,
            },
          },
        });
      }

      await tx.membroGrupo.deleteMany({
        where: {
          grupoId,
        },
      });

      await tx.grupo.delete({
        where: {
          id: grupoId,
        },
      });
    });

    const io = getIO();

    if (io) {
      participantesIds.forEach((participanteId) => {
        io.to(`u:${participanteId}`).emit("grupoRemovido", {
          grupoId,
          motivo: "EXCLUIDO",
        });
      });
    }

    return res.status(200).json({
      ok: true,
      grupoId,
    });
  } catch (error) {
    console.error("Erro ao apagar grupo:", error);

    return res.status(500).json({
      error: "Erro ao apagar grupo.",
    });
  }
}