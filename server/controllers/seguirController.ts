import { Request, Response, RequestHandler } from "express";
import {  NotificacaoTipo } from "@prisma/client";
import { recomputeAndEmitBadge, criarNotificacaoEEnviarPush } from "./notificacoesController.js"; 
import { prisma } from "../prisma.js";
import {
  obterOrganizacaoAtivaDoUsuario,
} from "../services/organizacoes.js";

async function criarNotifEAtualizarBadge(params: {
  usuarioId: string;
  actorId?: string | null;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  link?: string | null;
}) {
  try {
    await criarNotificacaoEEnviarPush({
      usuarioId: params.usuarioId,
      actorId: params.actorId ?? null,
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
      link: params.link ?? null,
    });
  } catch (e) {
    console.warn("[seguir] falha ao criar notificacao/push:", e);
  }
}

export const deixarDeSeguir: RequestHandler = async (req: any, res) => {
  const seguidorUsuarioId = req.userId!;
  const seguidoUsuarioId =
    (req.params as any).seguidoUsuarioId || (req.body as any).seguidoUsuarioId;

  if (!seguidoUsuarioId) {
    return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  }
  if (seguidoUsuarioId === seguidorUsuarioId) {
    return res.status(400).json({ message: "Operação inválida." });
  }

  const [seguidor, seguido] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: seguidorUsuarioId },
      select: { id: true, nomeDeUsuario: true },
    }),
    prisma.usuario.findUnique({
      where: { id: seguidoUsuarioId },
      select: { id: true, nomeDeUsuario: true },
    }),
  ]);

  const del = await prisma.seguidor.deleteMany({
    where: { seguidorUsuarioId, seguidoUsuarioId },
  });

  if (
    del.count === 0
  ) {
    return res.status(404).json({
      message:
        "Relação de follow não encontrada.",
    });
  }

  const organizacaoId =
    await obterOrganizacaoAtivaDoUsuario(
      seguidoUsuarioId
    );

  if (
    organizacaoId
  ) {
    await prisma.organizacaoSeguidor.deleteMany({
      where: {
        organizacaoId,

        usuarioId:
          seguidorUsuarioId,
      },
    });
  }

  if (del.count === 0) {
    return res.status(404).json({ message: "Relação de follow não encontrada." });
  }

  if (seguido && seguidor) {
    await criarNotifEAtualizarBadge({
      usuarioId: seguidoUsuarioId,
      actorId: seguidorUsuarioId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Atualização",
      mensagem: `@${seguidor.nomeDeUsuario} parou de te seguir`,
      link: `/perfil/${seguidorUsuarioId}`,
    });
  }
  return res.sendStatus(204);
};

export const removerSeguidor: RequestHandler = async (req: any, res) => {
  const meuUsuarioId = req.userId!;
  const seguidorUsuarioId = String(req.params?.seguidorUsuarioId || "").trim();

  if (!seguidorUsuarioId) {
    return res.status(400).json({ message: "seguidorUsuarioId é obrigatório" });
  }
  if (seguidorUsuarioId === meuUsuarioId) {
    return res.status(400).json({ message: "Operação inválida." });
  }

  const del = await prisma.seguidor.deleteMany({
    where: { seguidorUsuarioId, seguidoUsuarioId: meuUsuarioId },
  });

  if (
    !del.count
  ) {
    return res.status(404).json({
      message:
        "Esse usuário não te segue.",
    });
  }
  const organizacaoId =
    await obterOrganizacaoAtivaDoUsuario(
      meuUsuarioId
    );

  if (
    organizacaoId
  ) {
    await prisma.organizacaoSeguidor.deleteMany({
      where: {
        organizacaoId,

        usuarioId:
          seguidorUsuarioId,
      },
    });
  }

  if (!del.count) {
    return res.status(404).json({ message: "Esse usuário não te segue." });
  }

  const eu = await prisma.usuario.findUnique({
    where: { id: meuUsuarioId },
    select: { nomeDeUsuario: true },
  });

  if (eu) {
    await criarNotifEAtualizarBadge({
      usuarioId: seguidorUsuarioId,
      actorId: meuUsuarioId,
      tipo: NotificacaoTipo.FOLLOW_REMOVED,
      titulo: "Você foi removido",
      mensagem: `@${eu.nomeDeUsuario} removeu você dos seguidores`,
      link: `/perfil/${meuUsuarioId}`,
    });
  }
  return res.json({ ok: true });
};

export async function listarSeguindo(req: Request, res: Response) {
  const seguidorUsuarioId = (req as any).user?.id || (req as any).userId;
  if (!seguidorUsuarioId) return res.status(401).json({ error: "Não autenticado." });

  const rows = await prisma.seguidor.findMany({
    where: { seguidorUsuarioId },
    select: { seguidoUsuarioId: true },
    orderBy: { seguidoUsuarioId: "asc" },
  });

  return res.json(rows.map((r) => ({ seguidoUsuarioId: r.seguidoUsuarioId })));
}

export async function statusSeguidor(
  req: Request,
  res: Response
) {
  try {
    const seguidorUsuarioId =
      String(
        (req as any).user?.id ||
        (req as any).userId ||
        ""
      ).trim();

    const seguidoUsuarioId =
      String(
        req.query.seguidoUsuarioId ||
        ""
      ).trim();

    if (!seguidorUsuarioId) {
      return res.status(401).json({
        error: "Não autenticado.",
      });
    }

    if (!seguidoUsuarioId) {
      return res.status(400).json({
        error:
          "seguidoUsuarioId é obrigatório.",
      });
    }

    const relacao =
      await prisma.seguidor.findUnique({
        where: {
          seguidorUsuarioId_seguidoUsuarioId: {
            seguidorUsuarioId,
            seguidoUsuarioId,
          },
        },
        select: {
          id: true,
        },
      });

    const seguindo =
      Boolean(relacao);

    return res.json({
      seguindo,
      isFollowing: seguindo,
      pendente: false,
    });
  } catch (error) {
    console.error(
      "[statusSeguidor] erro:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível consultar o status do follow.",
    });
  }
}

export const seguirUsuario: RequestHandler = async (req: any, res) => {
  try {
    const seguidorUsuarioId = String(req.userId || "").trim();
    const seguidoUsuarioId = String(
      req.body?.seguidoUsuarioId || ""
    ).trim();

    if (!seguidorUsuarioId) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    if (!seguidoUsuarioId) {
      return res.status(400).json({
        message: "seguidoUsuarioId é obrigatório",
      });
    }

    if (seguidoUsuarioId === seguidorUsuarioId) {
      return res.status(400).json({
        message: "Não é permitido seguir a si mesmo.",
      });
    }

    const [seguidor, seguido] = await Promise.all([
      prisma.usuario.findUnique({
        where: {
          id: seguidorUsuarioId,
        },
        select: {
          id: true,
          nomeDeUsuario: true,
        },
      }),

      prisma.usuario.findUnique({
        where: {
          id: seguidoUsuarioId,
        },
        select: {
          id: true,
          nomeDeUsuario: true,
        },
      }),
    ]);

    if (!seguidor) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    if (!seguido) {
      return res.status(404).json({
        message: "Usuário a ser seguido não encontrado.",
      });
    }

    await prisma.notificacao.deleteMany({
      where: {
        usuarioId: seguidoUsuarioId,
        actorId: seguidorUsuarioId,
        tipo: NotificacaoTipo.FOLLOW,
        titulo: "Solicitação para seguir",
      },
    });

    const criado =
      await prisma.seguidor.createMany({
        data: [
          {
            seguidorUsuarioId,
            seguidoUsuarioId,
          },
        ],

        skipDuplicates:
          true,
      });

    const organizacaoId =
      await obterOrganizacaoAtivaDoUsuario(
        seguidoUsuarioId
      );

    if (
      organizacaoId
    ) {
      await prisma.organizacaoSeguidor.upsert({
        where: {
          organizacaoId_usuarioId: {
            organizacaoId,

            usuarioId:
              seguidorUsuarioId,
          },
        },

        update: {},

        create: {
          organizacaoId,

          usuarioId:
            seguidorUsuarioId,
        },
      });
    }

    if (
      criado.count === 0
    ) {
      return res.status(200).json({
        ok: true,
        seguindo: true,
        jaSeguindo: true,
      });
    }

    await criarNotifEAtualizarBadge({
      usuarioId: seguidoUsuarioId,
      actorId: seguidorUsuarioId,
      tipo: NotificacaoTipo.FOLLOW,
      titulo: "Novo seguidor",
      mensagem: `@${
        seguidor.nomeDeUsuario ?? "usuario"
      } começou a seguir você`,
      link: `/perfil/${seguidorUsuarioId}`,
    });

    return res.status(201).json({
      ok: true,
      seguindo: true,
    });
  } catch (e) {
    console.error("[seguir] erro ao seguir usuário:", e);

    return res.status(500).json({
      message: "Não foi possível seguir este usuário.",
    });
  }
};

export async function minhaRede(
  req: any,
  res: Response
) {
  try {
    const usuarioId =
      String(req.userId || "").trim();

    if (!usuarioId) {
      return res.status(401).json({
        message: "Não autenticado",
      });
    }

    const [seguidos, seguidores] =
      await Promise.all([
        prisma.seguidor.findMany({
          where: {
            seguidorUsuarioId:
              usuarioId,
          },
          include: {
            seguidoUsuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
              },
            },
          },
        }),

        prisma.seguidor.findMany({
          where: {
            seguidoUsuarioId:
              usuarioId,
          },
          include: {
            seguidorUsuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
              },
            },
          },
        }),
      ]);

    const seguindo =
      seguidos.map(
        (item) =>
          item.seguidoUsuario
      );

    const seguindoSet =
      new Set(
        seguindo.map(
          (usuario) =>
            usuario.id
        )
      );

    const seguidoresFmt =
      seguidores.map(
        (item) => ({
          ...item.seguidorUsuario,

          isSeguindo:
            seguindoSet.has(
              item
                .seguidorUsuario
                .id
            ),
        })
      );

    return res.json({
      seguindo,
      seguidores:
        seguidoresFmt,
    });
  } catch (e) {
    console.error(
      "[minhaRede]",
      e
    );

    return res.status(500).json({
      message:
        "Erro ao carregar minha rede",
    });
  }
}

export const aceitarSeguidor: RequestHandler = async (req: any, res) => {
  const seguidoUsuarioId = req.userId!;
  const { notificacaoId, seguidorUsuarioId } = req.body;

  const actorId = String(seguidorUsuarioId || "").trim();

  if (!actorId) {
    return res.status(400).json({ message: "seguidorUsuarioId é obrigatório." });
  }

  await prisma.seguidor.upsert({
    where: {
      seguidorUsuarioId_seguidoUsuarioId: {
        seguidorUsuarioId: actorId,
        seguidoUsuarioId,
      },
    },
    update: {},
    create: {
      seguidorUsuarioId: actorId,
      seguidoUsuarioId,
    },
  });

  await prisma.notificacao.deleteMany({
    where: {
      usuarioId: seguidoUsuarioId,
      actorId,
      tipo: NotificacaoTipo.FOLLOW,
    },
  });

  await criarNotifEAtualizarBadge({
    usuarioId: actorId,
    actorId: seguidoUsuarioId,
    tipo: NotificacaoTipo.GENERICA,
    titulo: "Solicitação aceita",
    mensagem: "Sua solicitação para seguir foi aceita.",
    link: `/perfil/${seguidoUsuarioId}`,
  });

  await recomputeAndEmitBadge(seguidoUsuarioId);

  return res.json({ ok: true });
};

export const recusarSeguidor: RequestHandler =
  async (req: any, res) => {
    const seguidoUsuarioId =
      req.userId!;

    const {
      seguidorUsuarioId,
    } = req.body;

    const actorId = String(
      seguidorUsuarioId || ""
    ).trim();

    if (!actorId) {
      return res.status(400).json({
        message:
          "seguidorUsuarioId é obrigatório.",
      });
    }

    await prisma.notificacao.deleteMany({
      where: {
        usuarioId:
          seguidoUsuarioId,
        actorId,
        tipo:
          NotificacaoTipo.FOLLOW,
      },
    });

    await criarNotifEAtualizarBadge({
      usuarioId: actorId,
      actorId: seguidoUsuarioId,
      tipo:
        NotificacaoTipo.GENERICA,
      titulo:
        "Solicitação recusada",
      mensagem:
        "Sua solicitação para seguir foi recusada.",
      link: `/perfil/${seguidoUsuarioId}`,
    });

    await recomputeAndEmitBadge(
      seguidoUsuarioId
    );

    return res.json({
      ok: true,
    });
  };