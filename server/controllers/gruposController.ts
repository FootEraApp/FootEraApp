import { Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { TipoMembro } from "@prisma/client";

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

export async function criarGrupo(req: AuthenticatedRequest, res: Response) {
  const { nome, descricao, membros } = req.body as {
    nome: string;
    descricao?: string;
    membros: string[];
  };

  const ownerId = req.userId;
  if (!ownerId) return res.status(401).json({ error: "Não autenticado" });
  if (!nome || !Array.isArray(membros)) {
    return res.status(400).json({ error: "Nome e lista de membros são obrigatórios" });
  }

  try {
    const membrosUnicos = Array.from(new Set(membros)).filter((id) => id !== ownerId);

    const grupo = await prisma.grupo.create({
      data: {
        nome,
        descricao: descricao ?? null,
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
        membros: { include: { usuario: true } },
      },
    });

    return res.status(201).json(grupo);
  } catch (error) {
    console.error("Erro ao criar grupo:", error);
    return res.status(500).json({ error: "Erro ao criar grupo" });
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
      where: { id: grupoId },
      select: { ownerId: true },
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

    await prisma.membroGrupo.update({
      where: {
        grupoId_usuarioId: {
          grupoId,
          usuarioId: membroId,
        },
      },
      data: {
        tipo: tipo === "ADMIN" ? TipoMembro.ADMIN : TipoMembro.MEMBRO,
      },
    });

    return res.status(200).json({ ok: true });
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

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao sair do grupo:", error);
    return res.status(500).json({ error: "Erro ao sair do grupo" });
  }
}