import { Router } from "express";
import { PrismaClient, IndicacaoStatus, NotificacaoTipo } from "@prisma/client";
import { recomputeAndEmitBadge } from "../controllers/notificacoesController.js";

const prisma = new PrismaClient();
const router = Router();

const PONTOS_POR_INDICACAO_APROVADA = 10;

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

function getOlheiroIdFromReq(req: any): string | null {
  return (
    req?.authUser?.tipoUsuarioId ||
    req?.user?.tipoUsuarioId ||
    req?.tipoUsuarioId ||
    req?.userCtx?.tipoUsuarioId ||
    req?.userCtx?.tipoUsuarioIdRaw ||
    (req.headers["x-tipo-usuario-id"] as string) ||
    null
  );
}

function getTipoUsuarioFromReq(req: any): string | null {
  const raw =
    req?.authUser?.tipo ||
    req?.user?.tipo ||
    req?.user?.tipoUsuario ||
    req?.tipoUsuario ||
    req?.userCtx?.tipo ||
    req?.userCtx?.tipoUsuario ||
    (req.headers["x-tipo-usuario"] as string) ||
    null;

  return raw ? String(raw) : null;
}

async function resolveOlheiroId(req: any): Promise<string | null> {
  const direto = getOlheiroIdFromReq(req);
  if (direto) return String(direto);

  const tipo = String(getTipoUsuarioFromReq(req) || "").toLowerCase();
  const usuarioId = getUsuarioIdFromReq(req);

  if (tipo !== "olheiro" || !usuarioId) {
    return null;
  }

  const olheiro = await prisma.olheiro.findUnique({
    where: { usuarioId: String(usuarioId) },
    select: { id: true },
  });

  return olheiro?.id ?? null;
}

router.post("/", async (req, res) => {
  try {
    const olheiroId = await resolveOlheiroId(req);
    if (!olheiroId) {
      return res.status(401).json({ error: "Não autenticado como olheiro." });
    }

    const tipo = getTipoUsuarioFromReq(req);
    if (tipo && String(tipo).toLowerCase() !== "olheiro") {
      return res.status(403).json({ error: "Apenas olheiro pode criar indicação." });
    }

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

    const usuarioLogadoId = getUsuarioIdFromReq(req);

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

      if (clube.usuarioId) {
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
          usuarioId: clube.usuarioId,
          actorId: usuarioLogadoId,
          titulo: "Nova indicação de atleta",
          mensagem: `${nomeOlheiro} indicou ${nomeAtleta} para ${clube.nome}.`,
          link: `/notificacoes?indicacaoId=${created.id}`,
          tipo: NotificacaoTipo.INDICACAO_OLHEIRO,
        });
      }

      if (clube.usuarioId) {
        await recomputeAndEmitBadge(clube.usuarioId);
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

    if (escolinha.usuarioId) {
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
        usuarioId: escolinha.usuarioId,
        actorId: usuarioLogadoId,
        titulo: "Nova indicação de atleta",
        mensagem: `${nomeOlheiro} indicou ${nomeAtleta} para ${escolinha.nome}.`,
        link: `/notificacoes?indicacaoId=${created.id}`,
        tipo: NotificacaoTipo.INDICACAO_OLHEIRO,
      });
    }

    if (escolinha.usuarioId) {
      await recomputeAndEmitBadge(escolinha.usuarioId);
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

    const destinoUsuarioId =
      indicacao.clube?.usuarioId ??
      indicacao.escolinha?.usuarioId ??
      null;

    if (!destinoUsuarioId || destinoUsuarioId !== usuarioId) {
      return res.status(403).json({ error: "Você não pode responder essa indicação." });
    }

    const updated = await prisma.indicacao.update({
      where: { id: String(id) },
      data: { status },
      select: { id: true, status: true, atualizadoEm: true, olheiroId: true },
    });

    if (indicacao.clube?.usuarioId) {
      await recomputeAndEmitBadge(indicacao.clube.usuarioId);
    }

    if (indicacao.escolinha?.usuarioId) {
      await recomputeAndEmitBadge(indicacao.escolinha.usuarioId);
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
          link: `/perfil/${destinoUsuarioId}`,
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

function getUsuarioIdFromReq(req: any): string | null {
  return (
    req?.userId ||
    req?.authUser?.id ||
    req?.user?.id ||
    req?.user?.usuarioId ||
    req?.usuarioId ||
    req?.userCtx?.id ||
    req?.userCtx?.usuarioId ||
    (req.headers["x-user-id"] as string) ||
    null
  );
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

    const olheiroId = await resolveOlheiroId(req);
    const usuarioId = getUsuarioIdFromReq(req);
    const tipoUsuario = String(getTipoUsuarioFromReq(req) || "").toLowerCase();

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    if (tipoUsuario && tipoUsuario !== "olheiro") {
      return res.status(403).json({ error: "Apenas olheiro pode apagar indicação." });
    }

    if (!olheiroId) {
      return res.status(401).json({ error: "Olheiro não autenticado." });
    }

    const indicacao = await prisma.indicacao.findUnique({
      where: { id: String(id) },
      include: {
        clube: { select: { usuarioId: true } },
        escolinha: { select: { usuarioId: true } },
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

    if (indicacao.clube?.usuarioId) {
      await recomputeAndEmitBadge(indicacao.clube.usuarioId);
    }

    if (indicacao.escolinha?.usuarioId) {
      await recomputeAndEmitBadge(indicacao.escolinha.usuarioId);
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/indicacoes/:id", e);
    return res.status(500).json({ error: "Falha ao apagar indicação." });
  }
});

export default router;