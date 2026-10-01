import { Router } from "express";
import {
  PrismaClient,
  IndicacaoStatus,
  NotificacaoTipo,
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";
import {
  getActiveContext,
} from "../services/activeContext.js";
import { recomputeAndEmitBadge } from "../controllers/notificacoesController.js";
import {
  canPermission,
} from "../services/permissions.js";
import {
  FuncaoMembroOrganizacao,
} from "@prisma/client";
import {
  obterOrganizacaoIdPorLegado,
} from "../services/organizacoes.js";

const prisma = new PrismaClient();
const router = Router();

const PONTOS_POR_INDICACAO_APROVADA = 10;

async function listarGestoresDaOrganizacao(
  tipo:
    | "CLUBE"
    | "ESCOLINHA",
  legacyId: string,
  fallbackUsuarioId?:
    string | null
) {
  const organizacaoId =
    await obterOrganizacaoIdPorLegado({
      tipo:
        tipo === "CLUBE"
          ? "CLUBE"
          : "ESCOLINHA",

      ownerId:
        legacyId,
    });

  const ids =
    new Set<string>();

  if (fallbackUsuarioId) {
    ids.add(
      fallbackUsuarioId
    );
  }

  if (!organizacaoId) {
    return Array.from(ids);
  }

  const membros =
    await prisma
      .membroOrganizacao
      .findMany({
        where: {
          organizacaoId,

          ativo:
            true,

          funcao: {
            in: [
              FuncaoMembroOrganizacao.PROPRIETARIO,
              FuncaoMembroOrganizacao.ADMINISTRADOR,
            ],
          },
        },

        select: {
          usuarioId:
            true,
        },
      });

  for (
    const membro of membros
  ) {
    ids.add(
      membro.usuarioId
    );
  }

  return Array.from(ids);
}

async function recalcularMetricasOlheiro(
  olheiroId: string
) {
  const [
    totalIndicacoes,
    indicacoesAprovadas,
  ] = await Promise.all([
    prisma.indicacao.count({
      where: {
        olheiroId,
      },
    }),

    prisma.indicacao.count({
      where: {
        olheiroId,
        status: IndicacaoStatus.APROVADA,
      },
    }),
  ]);

  const reputacaoScore =
    indicacoesAprovadas *
    PONTOS_POR_INDICACAO_APROVADA;

  await prisma.olheiro.update({
    where: {
      id: olheiroId,
    },

    data: {
      totalIndicacoes,
      reputacaoScore,
    },
  });

  return {
    totalIndicacoes,
    indicacoesAprovadas,
    reputacaoScore,
  };
}

router.post("/", async (req, res) => {
  try {
    const contextoOlheiro =
      await resolverOlheiroAtivo(
        req
      );

    if (!contextoOlheiro) {
      return res
        .status(409)
        .json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          error:
            "Use seu perfil de Olheiro para criar uma indicação.",
        });
    }

    const {
      usuarioId:
        usuarioLogadoId,
      olheiroId,
    } =
      contextoOlheiro;

    const { atletaId, clubeId, escolinhaId } = req.body || {};

    if (!atletaId) {
      return res.status(400).json({ error: "Informe atletaId." });
    }

    const hasClube = Boolean(clubeId);
    const hasEscolinha = Boolean(escolinhaId);

    if ((hasClube && hasEscolinha) || (!hasClube && !hasEscolinha)) {
      return res
        .status(400)
        .json({ error: "Informe clubeId OU escolinhaId (apenas um)." });
    }

    const [olheiro, atleta] = await Promise.all([
      prisma.olheiro.findUnique({
        where: { id: olheiroId },
        include: {
          usuario: {
            select: { id: true, nome: true, nomeDeUsuario: true },
          },
        },
      }),
      prisma.atleta.findUnique({
        where: { id: String(atletaId) },
        include: {
          usuario: {
            select: { id: true, nome: true, nomeDeUsuario: true },
          },
        },
      }),
    ]);

    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado." });
    if (hasClube) {
      const clube = await prisma.clube.findUnique({
        where: { id: String(clubeId) },
        select: {
          id: true,
          nome: true,
          usuarioId: true,
        },
      });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });

      const created = await prisma.indicacao.create({
        data: {
          olheiroId,
          atletaId: String(atletaId),
          clubeId: String(clubeId),
          status: IndicacaoStatus.PENDENTE,
        },
        select: { id: true, status: true, criadoEm: true },
      });

      await recalcularMetricasOlheiro(
        olheiroId
      );

      const gestores =
        await listarGestoresDaOrganizacao(
          "CLUBE",
          clube.id,
          clube.usuarioId
        );

      for (
        const gestorUsuarioId of
          gestores
      ) {
        const nomeOlheiro =
          olheiro?.usuario?.nome ||
          olheiro?.usuario?.nomeDeUsuario ||
          "Um olheiro";

        const nomeAtleta =
          atleta?.usuario?.nome ||
          atleta?.nome ||
          atleta?.usuario
            ?.nomeDeUsuario ||
          "um atleta";

        await criarNotificacaoIndicacao({
          usuarioId:
            gestorUsuarioId,

          actorId:
            usuarioLogadoId,

          titulo:
            "Nova indicação de atleta",

          mensagem:
            `${nomeOlheiro} indicou ${nomeAtleta} para ${clube.nome}.`,

          link:
            `/notificacoes?indicacaoId=${created.id}`,

          tipo:
            NotificacaoTipo.INDICACAO_OLHEIRO,
        });

        await recomputeAndEmitBadge(
          gestorUsuarioId
        );
      }
      return res.status(201).json(created);
    }

    const escolinha = await prisma.escolinha.findUnique({
      where: { id: String(escolinhaId) },
      select: {
        id: true,
        nome: true,
        usuarioId: true,
      },
    });
    if (!escolinha) {
      return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const gestores =
      await listarGestoresDaOrganizacao(
        "ESCOLINHA",
        escolinha.id,
        escolinha.usuarioId
      );

    const created = await prisma.indicacao.create({
      data: {
        olheiroId,
        atletaId: String(atletaId),
        escolinhaId: String(escolinhaId),
        status: IndicacaoStatus.PENDENTE,
      },
      select: { id: true, status: true, criadoEm: true },
    });

    await recalcularMetricasOlheiro(
      olheiroId
    );

    const nomeOlheiro =
      olheiro?.usuario?.nome ||
      olheiro?.usuario?.nomeDeUsuario ||
      "Um olheiro";

    const nomeAtleta =
      atleta?.usuario?.nome ||
      atleta?.nome ||
      atleta?.usuario
        ?.nomeDeUsuario ||
      "um atleta";

    for (
      const gestorUsuarioId of
        gestores
    ) {
      await criarNotificacaoIndicacao({
        usuarioId:
          gestorUsuarioId,

        actorId:
          usuarioLogadoId,

        titulo:
          "Nova indicação de atleta",

        mensagem:
          `${nomeOlheiro} indicou ${nomeAtleta} para ${escolinha.nome}.`,

        link:
          `/notificacoes?indicacaoId=${created.id}`,

        tipo:
          NotificacaoTipo.INDICACAO_OLHEIRO,
      });

      await recomputeAndEmitBadge(
        gestorUsuarioId
      );
    }

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("POST /api/indicacoes", e);
    return res.status(500).json({ error: "Falha ao criar indicação." });
  }
});

router.get("/olheiros/:id/indicacoes", async (req, res) => {
  try {
    const { id } = req.params;

    const list = await prisma.indicacao.findMany({
      where: { olheiroId: String(id) },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        status: true,
        criadoEm: true,
        atleta: {
          select: {
            id: true,
            usuarioId: true,
            nome: true,
            foto: true,

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
        clube: { select: { id: true, nome: true, logo: true, usuarioId: true } },
        escolinha: { select: { id: true, nome: true, logo: true, usuarioId: true } },
      },
    });

    const payload = list.map((i) => ({
      id: i.id,
      criadoEm: i.criadoEm,
      status: i.status as "PENDENTE" | "APROVADA" | "REJEITADA",
      atleta: {
        id: i.atleta.id,

        usuarioId:
          i.atleta.usuarioId ??
          i.atleta.usuario?.id ??
          null,

        nome:
          i.atleta.usuario?.nome ||
          i.atleta.nome ||
          i.atleta.usuario
            ?.nomeDeUsuario ||
          "Atleta",

        foto:
          i.atleta.usuario?.foto ??
          i.atleta.foto ??
          null,

        usuario:
          i.atleta.usuario
            ? {
                id:
                  i.atleta.usuario.id,

                nome:
                  i.atleta.usuario.nome,

                nomeDeUsuario:
                  i.atleta.usuario
                    .nomeDeUsuario,

                foto:
                  i.atleta.usuario.foto,
              }
            : null,
      },
      clube: i.clube
        ? {
            id: i.clube.id,
            nome: i.clube.nome,
            logo: i.clube.logo,
            usuarioId: i.clube.usuarioId,
            tipo: "Clube" as const,
          }
        : null,
      escolinha: i.escolinha
        ? {
            id: i.escolinha.id,
            nome: i.escolinha.nome,
            logo: i.escolinha.logo,
            usuarioId: i.escolinha.usuarioId,
            tipo: "Escolinha" as const,
          }
        : null,
    }));

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/indicacoes/olheiros/:id/indicacoes", e);
    return res.status(500).json({ error: "Falha ao listar indicações." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const usuarioId = getUsuarioIdFromReq(req);

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    if (!["PENDENTE", "APROVADA", "REJEITADA"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const indicacao = await prisma.indicacao.findUnique({
      where: { id: String(id) },
      include: {
        clube: { select: { id: true, usuarioId: true, nome: true } },
        escolinha: { select: { id: true, usuarioId: true, nome: true } },
        atleta: {
          select: {
            id: true,
            nome: true,
            usuario: { select: { nome: true } },
          },
        },
        olheiro: {
          include: {
            usuario: { select: { id: true, nome: true, nomeDeUsuario: true } },
          },
        },
      },
    });

    if (!indicacao) {
      return res.status(404).json({ error: "Indicação não encontrada." });
    }

    const contexto =
      await getActiveContext(
        usuarioId
      );

    const clubeId =
      indicacao.clube?.id
        ? String(
            indicacao.clube.id
          )
        : null;

    const escolinhaId =
      indicacao.escolinha?.id
        ? String(
            indicacao.escolinha.id
          )
        : null;

    const contextoCorreto =
      Boolean(
        contexto &&
        contexto.kind ===
          "ORGANIZATION" &&
        contexto
          .legacyOrganizationId &&
        (
          (
            clubeId &&
            contexto
              .organizationType ===
              TipoOrganizacao.CLUBE &&
            String(
              contexto
                .legacyOrganizationId
            ) === clubeId
          ) ||
          (
            escolinhaId &&
            contexto
              .organizationType ===
              TipoOrganizacao.ESCOLA &&
            String(
              contexto
                .legacyOrganizationId
            ) ===
              escolinhaId
          )
        )
      );

    if (!contextoCorreto) {
      return res
        .status(409)
        .json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          error:
            "Troque para a organização correspondente antes de responder esta indicação.",
        });
    }

    const podeGerenciar =
      await canPermission(
        usuarioId,
        "GERENCIAR_ORGANIZACAO"
      );

    if (!podeGerenciar) {
      return res
        .status(403)
        .json({
          code:
            "PERMISSION_DENIED",

          error:
            "Você não possui permissão para responder indicações desta organização.",
        });
    }

    const destinoUsuarioId =
      indicacao.clube?.usuarioId ??
      indicacao.escolinha?.usuarioId ??
      null;

    const updated = await prisma.indicacao.update({
      where: { id: String(id) },
      data: { status },
      select: { id: true, status: true, atualizadoEm: true, olheiroId: true },
    });

    await prisma.notificacao.deleteMany({
      where: {
        link:
          `/notificacoes?indicacaoId=${id}`,
      },
    });

    const gestoresDestino =
      indicacao.clube
        ? await listarGestoresDaOrganizacao(
            "CLUBE",
            indicacao.clube.id,
            indicacao.clube
              .usuarioId
          )
        : indicacao.escolinha
          ? await listarGestoresDaOrganizacao(
              "ESCOLINHA",
              indicacao.escolinha.id,
              indicacao.escolinha
                .usuarioId
            )
          : [];

    for (
      const gestorUsuarioId of
        gestoresDestino
    ) {
      await recomputeAndEmitBadge(
        gestorUsuarioId
      );
    }

    await recalcularMetricasOlheiro(
      updated.olheiroId
    );

    const nomeAtleta =
      indicacao.atleta?.usuario?.nome ||
      indicacao.atleta?.nome ||
      "o atleta";

    const nomeDestino =
      indicacao.clube?.nome ||
      indicacao.escolinha?.nome ||
      "a organização";

    const statusTexto =
      status === "APROVADA"
        ? "aceitou"
        : status === "REJEITADA"
        ? "recusou"
        : "atualizou";

    if (indicacao.olheiro?.usuario?.id) {
      await prisma.notificacao.create({
        data: {
          usuarioId: indicacao.olheiro.usuario.id,
          actorId: usuarioId,
          titulo: "Resposta da indicação",
          mensagem: `${nomeDestino} ${statusTexto} sua indicação de ${nomeAtleta}.`,
          link:
            destinoUsuarioId
              ? `/perfil/${encodeURIComponent(
                  destinoUsuarioId
                )}`
              : "/notificacoes",
          tipo: NotificacaoTipo.INDICACAO_RESPONDIDA,
          lida: false,
        },
      });

      await recomputeAndEmitBadge(indicacao.olheiro.usuario.id);
    }

    return res.json(updated);
  } catch (e: any) {
    console.error("PATCH /api/indicacoes/:id/status", e);
    return res.status(500).json({ error: "Falha ao atualizar status." });
  }
});

function getUsuarioIdFromReq(
  req: any
): string | null {
  const id =
    req?.userId ||
    req?.authUser?.id ||
    req?.user?.id ||
    null;

  return id
    ? String(id)
    : null;
}

async function resolverOlheiroAtivo(
  req: any
): Promise<{
  usuarioId: string;
  olheiroId: string;
} | null> {
  const usuarioId =
    getUsuarioIdFromReq(
      req
    );

  if (!usuarioId) {
    return null;
  }

  const contexto =
    await getActiveContext(
      usuarioId
    );

  if (
    !contexto ||
    contexto.kind !==
      "PERSONAL" ||
    contexto.tipoUsuario !==
      TipoUsuario.Olheiro ||
    !contexto.tipoUsuarioId
  ) {
    return null;
  }

  return {
    usuarioId,

    olheiroId:
      String(
        contexto
          .tipoUsuarioId
      ),
  };
}

async function criarNotificacaoIndicacao(params: {
  usuarioId: string;
  actorId?: string | null;
  titulo: string;
  mensagem: string;
  link?: string | null;
  tipo?: NotificacaoTipo;
}) {
  return prisma.notificacao.create({
    data: {
      usuarioId: params.usuarioId,
      actorId: params.actorId ?? null,
      titulo: params.titulo,
      mensagem: params.mensagem,
      link: params.link ?? null,
      lida: false,
      tipo: params.tipo ?? NotificacaoTipo.INDICACAO_OLHEIRO,
    },
  });
}

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const contextoOlheiro =
      await resolverOlheiroAtivo(
        req
      );

    if (!contextoOlheiro) {
      return res
        .status(409)
        .json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          error:
            "Use seu perfil de Olheiro para apagar esta indicação.",
        });
    }

    const {
      usuarioId,
      olheiroId,
    } =
      contextoOlheiro;

    const indicacao = await prisma.indicacao.findUnique({
      where: { id: String(id) },
      include: {
        clube: {
          select: {
            id:
              true,

            usuarioId:
              true,
          },
        },

        escolinha: {
          select: {
            id:
              true,

            usuarioId:
              true,
          },
        },
        olheiro: {
          include: {
            usuario: { select: { id: true } },
          },
        },
      },
    });

    if (!indicacao) {
      return res.status(404).json({ error: "Indicação não encontrada." });
    }

    if (indicacao.olheiroId !== olheiroId) {
      return res.status(403).json({ error: "Você não pode apagar esta indicação." });
    }

    await prisma.indicacao.delete({
      where: { id: String(id) },
    });

    await recalcularMetricasOlheiro(
      olheiroId
    );

    await prisma.notificacao.deleteMany({
      where: {
        OR: [
          { link: `/notificacoes?indicacaoId=${id}` },
          { link: `/indicacoes/${id}` },
        ],
      },
    }).catch(() => null);

    const gestoresDestino =
      indicacao.clube
        ? await listarGestoresDaOrganizacao(
            "CLUBE",
            indicacao.clube.id,
            indicacao.clube
              .usuarioId
          )
        : indicacao.escolinha
          ? await listarGestoresDaOrganizacao(
              "ESCOLINHA",
              indicacao.escolinha.id,
              indicacao.escolinha
                .usuarioId
            )
          : [];

    for (
      const gestorUsuarioId of
        gestoresDestino
    ) {
      await recomputeAndEmitBadge(
        gestorUsuarioId
      );
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/indicacoes/:id", e);
    return res.status(500).json({ error: "Falha ao apagar indicação." });
  }
});

export default router;