import { Response } from "express";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { NotificacaoTipo } from "@prisma/client";
import { criarNotificacaoEEnviarPush } from "./notificacoesController.js";

function ensureArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function uniq(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean).map(String)));
}

function labelPosicao(pos?: string) {
  const p = String(pos || "").toUpperCase();
  const map: Record<string, string> = {
    GOL: "GOL",
    LD: "LD",
    LE: "LE",
    ZD: "ZAG",
    ZC: "ZAG",
    ZE: "ZAG",
    VOL1: "VOL",
    VOL2: "VOL",
    MC1: "MC",
    MC2: "MC",
    MEI: "MEI",
    MEI_D: "MEI",
    MEI_E: "MEI",
    MD: "MD",
    ME: "ME",
    PD: "PD",
    PE: "PE",
    SA: "SA",
    CA: "CA",
  };
  return map[p] || p;
}

async function podeGerenciarConvocacao(
  req: AuthenticatedRequest,
  eventoId: string,
  turmaId: string
) {
  const usuarioId =
    String(
      req.userId ||
        req.user?.id ||
        ""
    ).trim();

  if (!usuarioId) {
    return false;
  }

  const isAdmin =
    req.user?.isAdmin ===
      true ||
    String(
      req.user?.tipo ||
      ""
    ).toLowerCase() ===
      "admin";

  if (isAdmin) {
    return true;
  }

  const [
    evento,
    turma,
  ] =
    await Promise.all([
      prisma.evento.findUnique({
        where: {
          id:
            eventoId,
        },

        select: {
          creatorUsuarioId:
            true,

          clube: {
            select: {
              usuarioId:
                true,
            },
          },

          escolinha: {
            select: {
              usuarioId:
                true,
            },
          },

          federacao: {
            select: {
              usuarioId:
                true,
            },
          },

          marca: {
            select: {
              usuarioId:
                true,
            },
          },
        },
      }),

      prisma.turma.findUnique({
        where: {
          id:
            turmaId,
        },

        select: {
          clube: {
            select: {
              usuarioId:
                true,
            },
          },

          escolinha: {
            select: {
              usuarioId:
                true,
            },
          },

          professores: {
            select: {
              professor: {
                select: {
                  usuarioId:
                    true,
                },
              },
            },
          },
        },
      }),
    ]);

  if (
    !evento ||
    !turma
  ) {
    return false;
  }

  const gerenciaEvento =
    [
      evento.creatorUsuarioId,
      evento.clube
        ?.usuarioId,
      evento.escolinha
        ?.usuarioId,
      evento.federacao
        ?.usuarioId,
      evento.marca
        ?.usuarioId,
    ]
      .filter(Boolean)
      .includes(usuarioId);

  const gerenciaTurma =
    [
      turma.clube
        ?.usuarioId,
      turma.escolinha
        ?.usuarioId,
      ...turma.professores.map(
        (item) =>
          item.professor
            .usuarioId
      ),
    ]
      .filter(Boolean)
      .includes(usuarioId);

  return (
    gerenciaEvento &&
    gerenciaTurma
  );
}

export async function getConvocacaoEvento(req: AuthenticatedRequest, res: Response) {
  try {
    const { eventoId } = req.params;
    const turmaId = String(req.query.turmaId || "");

    if (!eventoId) return res.status(400).json({ error: "eventoId obrigatório" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

    const permitido =
      await podeGerenciarConvocacao(
        req,
        eventoId,
        turmaId
      );

    if (!permitido) {
      return res.status(403).json({
        error:
          "Sem permissão para visualizar esta convocação.",
      });
    }

    const c = await prisma.eventoConvocacao.findFirst({
      where: { eventoId, turmaId },
    });

    return res.json(c ?? null);
  } catch (e) {
    console.error("getConvocacaoEvento:", e);
    return res.status(500).json({ error: "Erro ao buscar convocação" });
  }
}

export async function upsertConvocacaoEvento(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { eventoId } = req.params;

    const {
      turmaId,
      nome,
      formacao,
      escala,
      reservasIds,
    } = req.body ?? {};

    if (!eventoId) {
      return res.status(400).json({
        error: "eventoId obrigatório",
      });
    }

    if (!turmaId) {
      return res.status(400).json({
        error: "turmaId obrigatório",
      });
    }

    const permitido =
      await podeGerenciarConvocacao(
        req,
        eventoId,
        String(turmaId)
      );

    if (!permitido) {
      return res.status(403).json({
        error:
          "Sem permissão para salvar esta convocação.",
      });
    }

    if (!eventoId) return res.status(400).json({ error: "eventoId obrigatório" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

    const reservas = uniq(ensureArray<string>(reservasIds ?? req.body?.reservas));
    if (reservas.length > 11) {
      return res.status(400).json({ error: "Reservas não pode passar de 11." });
    }

    const escalaObj = escala && typeof escala === "object" && !Array.isArray(escala) ? escala : {};
    const titularesIds = uniq(Object.values(escalaObj).filter(Boolean) as string[]);

    if (titularesIds.length !== 11) {
      return res.status(400).json({ error: `Titulares precisam ser exatamente 11. Atual: ${titularesIds.length}` });
    }

    const dup = reservas.filter((id) => titularesIds.includes(id));
    if (dup.length) {
      return res.status(400).json({ error: "Um atleta não pode ser titular e reserva ao mesmo tempo." });
    }

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento) return res.status(404).json({ error: "Evento não encontrado" });

    const saved = await prisma.eventoConvocacao.upsert({
      where: {
        eventoId_turmaId: {
            eventoId,
            turmaId,
        }
     },
      create: {
        eventoId,
        turmaId,
        nome: nome || "Convocação",
        formacao: formacao || null,
        escala: escalaObj,
        reservasIds: reservas,
      },
      update: {
        turmaId,
        nome: nome || "Convocação",
        formacao: formacao || null,
        escala: escalaObj,
        reservasIds: reservas,
      },
    });

    const posByAtleta: Record<string, string> = {};
    for (const [pos, atletaId] of Object.entries(escalaObj)) {
      if (atletaId) posByAtleta[String(atletaId)] = String(pos);
    }

    await prisma.eventoConvocado.deleteMany({
      where: { eventoId, turmaId },
    });

    const convocadosData = [
    ...titularesIds.map((id: string) => ({
      eventoId,
      turmaId,              
      atletaId: id,
      tipo: "TITULAR",
      posicao: posByAtleta[id] || null,
    })),

    ...reservas.map((id: string) => ({
      eventoId,
      turmaId,              
      atletaId: id,
      tipo: "RESERVA",
      posicao: null,
    })),
  ];

    if (convocadosData.length) {
      await prisma.eventoConvocado.createMany({
        data: convocadosData,
        skipDuplicates: true,
      });
    }

    const allIds = [...titularesIds, ...reservas];
    const atletas = await prisma.atleta.findMany({
      where: { id: { in: allIds } },
      select: { id: true, usuarioId: true },
    });

    const inicioStr = evento.dataEvento ? new Date(evento.dataEvento as any).toLocaleString("pt-BR") : "";
    const linkEvento =
      `/evento/${encodeURIComponent(
        eventoId
      )}`;

    const deId = String(req.userId || req.user?.id || "").trim();
    if (!deId) return res.status(401).json({ error: "Não autenticado" });

    const msgTag = `[CONVOCACAO_EVENTO:${eventoId}:${turmaId}]`;

    const notifs = atletas.map((a) => {
      const isReserva = reservas.includes(a.id);
      const posRaw = isReserva ? "RESERVA" : (posByAtleta[a.id] || "TITULAR");
      const posKey = posByAtleta[a.id];
      const pos = isReserva ? "Reserva" : (posKey ? `Titular (${labelPosicao(posKey)})` : "Titular");

      return {
        usuarioId: a.usuarioId,
        titulo: `Convocação: ${evento.titulo}`,
        mensagem:
          `Você foi convocado para o evento "${evento.titulo}" como ${pos}.` +
          (inicioStr ? ` Data/Hora: ${inicioStr}.` : "") +
          ` Acesse: ${linkEvento}`,
        link: linkEvento,
      };
    });

    await prisma.notificacao.deleteMany({
      where: {
        usuarioId: {
          in:
            atletas.map(
              (a) =>
                a.usuarioId
            ),
        },

        OR: [
          {
            link:
              `/eventos/${eventoId}`,
          },
          {
            link:
              linkEvento,
          },
        ],
      },
    });

    await Promise.allSettled(
      notifs
        .filter((n) => !!n.usuarioId)
        .map((n) =>
          criarNotificacaoEEnviarPush({
            usuarioId: n.usuarioId,
            actorId: deId,
            tipo: NotificacaoTipo.CONVOCACAO,
            titulo: n.titulo,
            mensagem: n.mensagem,
            link: n.link,
          })
        )
    );

    await prisma.mensagem.deleteMany({
      where: {
        paraId: { in: atletas.map((a) => a.usuarioId) },
        conteudo: { contains: msgTag },
      },
    });

    await prisma.mensagem.createMany({
      data: atletas.map((a) => {
        const isReserva = reservas.includes(a.id);
        const posKey = isReserva ? null : posByAtleta[a.id];
        const posLabel = isReserva ? "Reserva" : (posKey ? `Titular (${labelPosicao(posKey)})` : "Titular");

        const conteudo =
          `${msgTag}\n` +
          `📣 Convocação: ${evento.titulo}\n` +
          `✅ Você foi convocado como ${posLabel}.` +
          (inicioStr ? `\n🗓️ Data/Hora: ${inicioStr}` : "") +
          `\n🔗 Link: ${linkEvento}`;

        return {
          deId,            
          paraId: a.usuarioId,
          conteudo,
          tipo: "NORMAL" as const,
          atletaId: a.id,
        };
      }),
    });

    return res.json(saved);
  } catch (e) {
    console.error("upsertConvocacaoEvento:", e);
    return res.status(500).json({ error: "Erro ao salvar convocação" });
  }
}