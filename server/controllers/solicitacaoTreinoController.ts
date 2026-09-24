import { Response, Request } from "express";
import { prisma } from "../prisma.js";
import { NotificacaoTipo } from "@prisma/client";
import { criarNotificacaoEEnviarPush } from "./notificacoesController.js";
import { obterOrganizacaoIdPorLegado } from "../services/organizacoes.js";

const getBase = (req: Request) =>
  process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

const absFoto = (req: Request, f?: string | null) =>
  f
    ? (/^(https?:|data:|blob:)/i.test(f)
        ? f
        : `${getBase(req)}${f.startsWith("/") ? f : `/${f}`}`)
    : null;

type PapelTreino =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha";

function normalizarPapelTreino(
  valor: unknown
): PapelTreino | null {
  const raw = String(
    valor ?? ""
  )
    .trim()
    .toLowerCase();

  if (raw === "atleta") {
    return "Atleta";
  }

  if (raw === "professor") {
    return "Professor";
  }

  if (raw === "clube") {
    return "Clube";
  }

  if (
    raw === "escola" ||
    raw === "escolinha"
  ) {
    return "Escolinha";
  }

  return null;
}

async function getIdsByPapel(
  usuarioId: string,
  papel: PapelTreino
): Promise<{
  atletaId?: string;
  professorId?: string;
  clubeId?: string;
  escolinhaId?: string;
}> {
  switch (papel) {
    case "Atleta": {
      const row =
        await prisma.atleta.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        });

      return {
        atletaId:
          row?.id,
      };
    }

    case "Professor": {
      const row =
        await prisma.professor.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        });

      return {
        professorId:
          row?.id,
      };
    }

    case "Clube": {
      const row =
        await prisma.clube.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        });

      return {
        clubeId:
          row?.id,
      };
    }

    case "Escolinha": {
      const row =
        await prisma.escolinha.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        });

      return {
        escolinhaId:
          row?.id,
      };
    }
  }
}

function perfilExisteParaPapel(
  ids: Awaited<
    ReturnType<typeof getIdsByPapel>
  >,
  papel: PapelTreino
) {
  if (papel === "Atleta") {
    return !!ids.atletaId;
  }

  if (papel === "Professor") {
    return !!ids.professorId;
  }

  if (papel === "Clube") {
    return !!ids.clubeId;
  }

  return !!ids.escolinhaId;
}

function combinacaoTreinoPermitida(
  a: PapelTreino,
  b: PapelTreino
) {
  if (
    a === "Atleta" ||
    b === "Atleta"
  ) {
    const outro =
      a === "Atleta"
        ? b
        : a;

    return [
      "Professor",
      "Clube",
      "Escolinha",
    ].includes(outro);
  }

  if (
    a === "Professor" &&
    b === "Professor"
  ) {
    return true;
  }

  if (
    (a === "Professor" &&
      b === "Clube") ||
    (a === "Clube" &&
      b === "Professor")
  ) {
    return true;
  }

  if (
    (a === "Professor" &&
      b === "Escolinha") ||
    (a === "Escolinha" &&
      b === "Professor")
  ) {
    return true;
  }

  return false;
}

export async function listarSolicitacoesMinhas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { remetenteId: me },             
      include: {
        destinatario: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,
      criadaEm: s.criadoEm,
      destinatarioId: s.destinatarioId,
      destinatario: {
        id: s.destinatario.id,
        nomeDeUsuario: s.destinatario.nomeDeUsuario,
        nome: s.destinatario.nome,
        foto: absFoto(req, s.destinatario.foto),   
      },
      remetentePapel:
        s.remetentePapel ??
        null,

      destinatarioPapel:
        s.destinatarioPapel ??
        null,
    }));

    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Falha ao listar solicitações" });
  }
}

export async function listarSolicitacoesRecebidas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Usuário não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { destinatarioId: me, status: { in: ["pendente", "ativa"] } }, 
      include: {
        remetente: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,               
      criadaEm: s.criadoEm,
      remetenteId: s.remetenteId,
      remetente: {
        id: s.remetente.id,
        nomeDeUsuario: s.remetente.nomeDeUsuario,
        nome: s.remetente.nome,
        foto: absFoto(req, s.remetente.foto),
      },
      remetentePapel:
        s.remetentePapel ??
        null,

      destinatarioPapel:
        s.destinatarioPapel ??
        null,
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao listar solicitações recebidas:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function criarSolicitacao(
  req: Request,
  res: Response
) {
  try {
    const remetenteId:
      | string
      | undefined =
      (req as any).user?.id ||
      (req as any).userId;

    const {
      destinatarioId,
      remetentePapel:
        remetentePapelRaw,
      destinatarioPapel:
        destinatarioPapelRaw,
    } = (req.body ?? {}) as {
      destinatarioId?: string;
      remetentePapel?: string;
      destinatarioPapel?: string;
    };

    if (!remetenteId) {
      return res.status(401).json({
        message:
          "Não autenticado.",
      });
    }

    if (!destinatarioId) {
      return res.status(400).json({
        message:
          "destinatarioId é obrigatório",
      });
    }

    if (
      remetenteId ===
      destinatarioId
    ) {
      return res.status(400).json({
        message:
          "Não é permitido criar vínculo consigo mesmo.",
      });
    }

    const [
      usuarioOrigem,
      usuarioDestino,
    ] = await Promise.all([
      prisma.usuario.findUnique({
        where: {
          id: remetenteId,
        },
        select: {
          id: true,
          tipo: true,
          nomeDeUsuario: true,
        },
      }),

      prisma.usuario.findUnique({
        where: {
          id: destinatarioId,
        },
        select: {
          id: true,
          tipo: true,
          nomeDeUsuario: true,
        },
      }),
    ]);

    if (
      !usuarioOrigem ||
      !usuarioDestino
    ) {
      return res.status(404).json({
        message:
          "Usuário de origem ou destino não encontrado.",
      });
    }

    const remetentePapel =
      normalizarPapelTreino(
        remetentePapelRaw
      ) ??
      normalizarPapelTreino(
        usuarioOrigem.tipo
      );

    const destinatarioPapel =
      normalizarPapelTreino(
        destinatarioPapelRaw
      ) ??
      normalizarPapelTreino(
        usuarioDestino.tipo
      );

    if (
      !remetentePapel ||
      !destinatarioPapel
    ) {
      return res.status(400).json({
        message:
          "Não foi possível determinar os papéis usados neste vínculo.",
      });
    }

    if (
      !combinacaoTreinoPermitida(
        remetentePapel,
        destinatarioPapel
      )
    ) {
      return res.status(400).json({
        message:
          "Essa combinação de perfis não pode criar vínculo de treino.",
      });
    }

    const [
      idsRem,
      idsDes,
    ] =
      await Promise.all([
        getIdsByPapel(
          remetenteId,
          remetentePapel
        ),

        getIdsByPapel(
          destinatarioId,
          destinatarioPapel
        ),
      ]);

    if (
      !perfilExisteParaPapel(
        idsRem,
        remetentePapel
      )
    ) {
      return res.status(400).json({
        message:
          `Sua conta não possui o perfil ${remetentePapel}.`,
      });
    }

    if (
      !perfilExisteParaPapel(
        idsDes,
        destinatarioPapel
      )
    ) {
      return res.status(400).json({
        message:
          `O usuário não possui o perfil ${destinatarioPapel}.`,
      });
    }

    const ids = {
      atletaId:
        idsRem.atletaId ||
        idsDes.atletaId,

      professorId:
        idsRem.professorId ||
        idsDes.professorId,

      clubeId:
        idsRem.clubeId ||
        idsDes.clubeId,

      escolinhaId:
        idsRem.escolinhaId ||
        idsDes.escolinhaId,
    };

    let jaVinculados = false;

    if (
      remetentePapel ===
        "Professor" &&
      destinatarioPapel ===
        "Professor"
    ) {
      const professorAId =
        idsRem.professorId! <
        idsDes.professorId!
          ? idsRem.professorId!
          : idsDes.professorId!;

      const professorBId =
        idsRem.professorId! <
        idsDes.professorId!
          ? idsDes.professorId!
          : idsRem.professorId!;

      const existente =
        await prisma.professorParceiro.findUnique({
          where: {
            professorAId_professorBId: {
              professorAId,
              professorBId,
            },
          },
        });

      if (existente) {
        jaVinculados = true;
      } else {
        await prisma.professorParceiro.create({
          data: {
            professorAId,
            professorBId,
          },
        });
      }
    }

    else if (
      !ids.atletaId &&
      ids.professorId &&
      ids.clubeId &&
      !ids.escolinhaId
    ) {
      const existente =
        await prisma.professorClube.findUnique({
          where: {
            professorId_clubeId: {
              professorId:
                ids.professorId,

              clubeId:
                ids.clubeId,
            },
          },
        });

      jaVinculados =
        !!existente;

      await prisma.$transaction(
        async (tx) => {
          if (!existente) {
            await tx.professorClube.create({
              data: {
                professor: {
                  connect: {
                    id:
                      ids.professorId!,
                  },
                },

                clube: {
                  connect: {
                    id:
                      ids.clubeId!,
                  },
                },
              },
            });
          }

          await tx.professor.update({
            where: {
              id:
                ids.professorId!,
            },
            data: {
              clubeId:
                ids.clubeId!,
            },
          });
        }
      );
    }

    else if (
      !ids.atletaId &&
      ids.professorId &&
      ids.escolinhaId &&
      !ids.clubeId
    ) {
      const existente =
        await prisma.professorEscolinha.findUnique({
          where: {
            professorId_escolinhaId: {
              professorId:
                ids.professorId,

              escolinhaId:
                ids.escolinhaId,
            },
          },
        });

      jaVinculados =
        !!existente;

      await prisma.$transaction(
        async (tx) => {
          if (!existente) {
            await tx.professorEscolinha.create({
              data: {
                professor: {
                  connect: {
                    id:
                      ids.professorId!,
                  },
                },

                escolinha: {
                  connect: {
                    id:
                      ids.escolinhaId!,
                  },
                },
              },
            });
          }

          await tx.professor.update({
            where: {
              id:
                ids.professorId!,
            },

            data: {
              escolinhaId:
                ids.escolinhaId!,
            },
          });
        }
      );
    }

    else {
      const owners = [
        ids.professorId,
        ids.clubeId,
        ids.escolinhaId,
      ].filter(Boolean);

      if (
        !ids.atletaId ||
        owners.length !== 1
      ) {
        return res.status(400).json({
          message:
            "Para criar o vínculo deve existir um atleta e exatamente um professor, clube ou escolinha.",
        });
      }

      const existente =
        await prisma.relacaoTreinamento.findFirst({
          where: {
            atletaId:
              ids.atletaId,

            professorId:
              ids.professorId ??
              null,

            clubeId:
              ids.clubeId ??
              null,

            escolinhaId:
              ids.escolinhaId ??
              null,
          },
        });

      const organizacaoRelacaoId =
        ids.clubeId
          ? await obterOrganizacaoIdPorLegado({
              tipo: "CLUBE",
              ownerId: ids.clubeId,
            })
          : ids.escolinhaId
            ? await obterOrganizacaoIdPorLegado({
                tipo: "ESCOLINHA",
                ownerId: ids.escolinhaId,
              })
            : null;

      jaVinculados =
        Boolean(
          existente?.ativo &&
            !existente
              ?.encerradoEm
        );

      if (!jaVinculados) {
        await prisma.$transaction(
          async (tx) => {
            if (existente) {
              await tx.relacaoTreinamento.update({
                where: {
                  id:
                    existente.id,
                },

                data: {
                  ativo: true,
                  encerradoEm:
                    null,
                  organizacaoId: organizacaoRelacaoId
                },
              });
            } else {
              await tx.relacaoTreinamento.create({
                data: {
                  atletaId:
                    ids.atletaId!,

                  professorId:
                    ids.professorId ??
                    null,

                  clubeId:
                    ids.clubeId ??
                    null,

                  escolinhaId:
                    ids.escolinhaId ??
                    null,

                  organizacaoId: organizacaoRelacaoId,

                  ativo: true,
                  encerradoEm:
                    null,
                },
              });
            }

            if (
              ids.atletaId &&
              ids.clubeId
            ) {
              await tx.atleta.update({
                where: {
                  id:
                    ids.atletaId,
                },

                data: {
                  clubeId:
                    ids.clubeId,
                },
              });

              const formacao =
                await tx.vinculoFormacao.findFirst({
                  where: {
                    atletaId:
                      ids.atletaId,

                    origem:
                      "Clube",

                    origemId:
                      ids.clubeId,
                  },
                });

              if (!formacao) {
                await tx.vinculoFormacao.create({
                  data: {
                    atletaId:
                      ids.atletaId,

                    origem:
                      "Clube",

                    origemId:
                      ids.clubeId,
                  },
                });
              }
            }

            if (
              ids.atletaId &&
              ids.escolinhaId
            ) {
              await tx.atleta.update({
                where: {
                  id:
                    ids.atletaId,
                },

                data: {
                  escolinhaId:
                    ids.escolinhaId,
                },
              });

              const formacao =
                await tx.vinculoFormacao.findFirst({
                  where: {
                    atletaId:
                      ids.atletaId,

                    origem:
                      "Escolinha",

                    origemId:
                      ids.escolinhaId,
                  },
                });

              if (!formacao) {
                await tx.vinculoFormacao.create({
                  data: {
                    atletaId:
                      ids.atletaId,

                    origem:
                      "Escolinha",

                    origemId:
                      ids.escolinhaId,
                  },
                });
              }
            }
          }
        );
      }
    }

    await prisma.solicitacaoTreino.deleteMany({
      where: {
        OR: [
          {
            remetenteId,
            destinatarioId,
          },

          {
            remetenteId:
              destinatarioId,

            destinatarioId:
              remetenteId,
          },
        ],
      },
    });

    await prisma.notificacao.deleteMany({
      where: {
        titulo:
          "Solicitação de treino",

        OR: [
          {
            usuarioId:
              destinatarioId,

            actorId:
              remetenteId,
          },

          {
            usuarioId:
              remetenteId,

            actorId:
              destinatarioId,
          },
        ],
      },
    });

    if (!jaVinculados) {
      await criarNotificacaoEEnviarPush({
        usuarioId:
          destinatarioId,

        actorId:
          remetenteId,

        tipo:
          NotificacaoTipo.TREINO,

        titulo:
          "Novo vínculo de treino",

        mensagem:
          `@${
            usuarioOrigem
              .nomeDeUsuario ??
            "usuario"
          } começou a treinar junto com você.`,

        link:
          `/perfil/${remetenteId}`,
      });
    }

    return res
      .status(
        jaVinculados
          ? 200
          : 201
      )
      .json({
        ok: true,
        vinculo: true,
        jaVinculados,

        message:
          jaVinculados
            ? "Vocês já treinam juntos."
            : "Vínculo de treino criado com sucesso.",
      });
  } catch (error) {
    console.error(
      "Erro ao criar vínculo de treino:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao criar vínculo de treino.",
      });
  }
}

async function acharPendente(
  userId: string,
  outroUsuarioId: string
) {
  if (!userId || !outroUsuarioId) return null;
  return prisma.solicitacaoTreino.findFirst({
    where: {
      status: { in: ["pendente", "ativa"] },
      OR: [
        { remetenteId: userId,        destinatarioId: outroUsuarioId },
        { remetenteId: outroUsuarioId, destinatarioId: userId },
      ],
    },
    orderBy: { criadoEm: "desc" },
  });
}

async function cancelarPorSolicitacaoId(
  solicitacaoId: string,
  userId?: string,
): Promise<boolean> {
  if (!solicitacaoId) return false;

  const s = await prisma.solicitacaoTreino.findUnique({ where: { id: solicitacaoId } });

  if (!s) return false;
  if (userId && s.remetenteId !== userId && s.destinatarioId !== userId) return false;

  try {
    await prisma.solicitacaoTreino.delete({ where: { id: solicitacaoId } });
  } catch {
    await prisma.solicitacaoTreino.update({
      where: { id: solicitacaoId },
      data: { status: "cancelada" as any },
    });
  }
  return true;
}

export async function cancelarSolicitacao(req: Request, res: Response) {
  try {
    const userId: string | undefined = (req as any).user?.id || (req as any).userId;

    const solicitacaoId  = (req.params as any).id
                        || (req.body?.id ?? req.query?.id) || null;
    const destinatarioId = (req.params as any).destinatarioId
                        || (req.body?.destinatarioId ?? req.query?.destinatarioId) || null;

    if (solicitacaoId) {
      await cancelarPorSolicitacaoId(String(solicitacaoId), userId);
      return res.sendStatus(204);
    }

    if (userId && destinatarioId) {
      const pend = await acharPendente(userId, String(destinatarioId));
      if (!pend) return res.sendStatus(204);
      await cancelarPorSolicitacaoId(pend.id, userId);
      return res.sendStatus(204);
    }

    return res.status(400).json({ error: "Informe id ou destinatarioId" });
  } catch (e) {
    console.error("cancelarSolicitacao", e);
    return res.status(500).json({ error: "Falha ao cancelar solicitação" });
  }
}

export async function aceitarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const destinatarioId: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!destinatarioId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== destinatarioId) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    const [remetente, destinatario] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: solicitacao.remetenteId },
        select: { id: true, tipo: true },
      }),
      prisma.usuario.findUnique({
        where: { id: solicitacao.destinatarioId },
        select: { id: true, tipo: true },
      }),
    ]);

    if (!remetente || !destinatario) {
      return res.status(404).json({ error: "Usuário da solicitação não encontrado." });
    }

    const remetentePapel =
      normalizarPapelTreino(
        solicitacao.remetentePapel
      ) ??
      normalizarPapelTreino(
        remetente.tipo
      );

    const destinatarioPapel =
      normalizarPapelTreino(
        solicitacao.destinatarioPapel
      ) ??
      normalizarPapelTreino(
        destinatario.tipo
      );

    if (
      !remetentePapel ||
      !destinatarioPapel
    ) {
      return res
        .status(400)
        .json({
          error:
            "Os papéis da solicitação são inválidos.",
        });
    }

    const [
      idsRem,
      idsDes,
    ] =
      await Promise.all([
        getIdsByPapel(
          remetente.id,
          remetentePapel
        ),

        getIdsByPapel(
          destinatario.id,
          destinatarioPapel
        ),
      ]);

    const ids = {
      professorId:
        idsRem.professorId ||
        idsDes.professorId,

      atletaId:
        idsRem.atletaId ||
        idsDes.atletaId,

      escolinhaId:
        idsRem.escolinhaId ||
        idsDes.escolinhaId,

      clubeId:
        idsRem.clubeId ||
        idsDes.clubeId,
    };

    const tipos = [
      remetentePapel,
      destinatarioPapel,
    ].sort();

    if (
      (tipos.includes("Clube") && tipos.includes("Escolinha")) ||
      (tipos[0] === "Clube" && tipos[1] === "Clube") ||
      (tipos[0] === "Escolinha" && tipos[1] === "Escolinha")
    ) {
      return res.status(400).json({
        error:
          "Essa combinação não pode treinar junto. Clube e escolinha não podem treinar juntos, clube com clube não pode e escolinha com escolinha não pode.",
      });
    }

    if (!ids.atletaId && ids.professorId && ids.escolinhaId && !ids.clubeId) {
      const professorId = ids.professorId;
      const escolinhaId = ids.escolinhaId;

      const existe = await prisma.professorEscolinha.findUnique({
        where: {
          professorId_escolinhaId: {
            professorId,
            escolinhaId,
          },
        },
      });

      await prisma.$transaction(async (tx) => {
        if (!existe) {
          await tx.professorEscolinha.create({
            data: {
              professor: { connect: { id: professorId } },
              escolinha: { connect: { id: escolinhaId } },
            },
          });
        }

        await tx.professor.update({
          where: { id: professorId },
          data: { escolinhaId },
        });

        await tx.solicitacaoTreino.delete({ where: { id } });
      });

      return res.json({
        ok: true,
        message: existe
          ? "Vínculo professor/escolinha já existia. Solicitação removida."
          : "Solicitação aceita com sucesso.",
      });
    }

    if (!ids.atletaId && ids.professorId && ids.clubeId && !ids.escolinhaId) {
      const professorId = ids.professorId;
      const clubeId = ids.clubeId;

      const existe = await prisma.professorClube.findUnique({
        where: {
          professorId_clubeId: {
            professorId,
            clubeId,
          },
        },
      });

      await prisma.$transaction(async (tx) => {
        if (!existe) {
          await tx.professorClube.create({
            data: {
              professor: { connect: { id: professorId } },
              clube: { connect: { id: clubeId } },
            },
          });
        }

        await tx.professor.update({
          where: { id: professorId },
          data: { clubeId },
        });

        await tx.solicitacaoTreino.delete({ where: { id } });
      });

      return res.json({
        ok: true,
        message: existe
          ? "Vínculo professor/clube já existia. Solicitação removida."
          : "Solicitação aceita com sucesso.",
      });
    }

    if (!ids.atletaId && ids.professorId && !ids.clubeId && !ids.escolinhaId) {
      const idsProf = [idsRem.professorId, idsDes.professorId].filter(
        (id): id is string => Boolean(id)
      );

      if (idsProf.length === 2) {
        const [professorAId, professorBId] =
          idsProf[0] < idsProf[1]
            ? [idsProf[0], idsProf[1]]
            : [idsProf[1], idsProf[0]];

        const existe = await prisma.professorParceiro.findFirst({
          where: {
            professorAId,
            professorBId,
          },
        });

        if (!existe) {
          await prisma.professorParceiro.create({
            data: {
              professorAId,
              professorBId,
            },
          });
        }

        await prisma.solicitacaoTreino.delete({ where: { id } });

        return res.json({
          ok: true,
          message: existe
            ? "Vínculo entre professores já existia. Solicitação removida."
            : "Solicitação aceita com sucesso.",
        });
      }
    }

    const owners = [ids.professorId, ids.clubeId, ids.escolinhaId].filter(Boolean);

    if (!ids.atletaId || owners.length !== 1) {
      return res.status(400).json({
        error:
          "Solicitação inválida. Para criar relação de treino, deve existir 1 atleta e exatamente 1 responsável (professor, clube ou escolinha).",
      });
    }

    const organizacaoRelacaoId =
      ids.clubeId
        ? await obterOrganizacaoIdPorLegado({
            tipo: "CLUBE",
            ownerId: ids.clubeId,
          })
        : ids.escolinhaId
          ? await obterOrganizacaoIdPorLegado({
              tipo: "ESCOLINHA",
              ownerId: ids.escolinhaId,
            })
          : null;

    const relacaoShape = {
      atletaId: ids.atletaId,
      professorId: ids.professorId ?? null,
      clubeId: ids.clubeId ?? null,
      escolinhaId: ids.escolinhaId ?? null,
      organizacaoId: organizacaoRelacaoId,
      ativo: true,
      encerradoEm: null,
    };

    const existente = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId: ids.atletaId,
        professorId: ids.professorId ?? null,
        clubeId: ids.clubeId ?? null,
        escolinhaId: ids.escolinhaId ?? null,
      },
    });

    await prisma.$transaction(async (tx) => {
      if (existente) {
        await tx.relacaoTreinamento.update({
          where: { id: existente.id },
          data: {
            ativo: true,
            encerradoEm: null,
            organizacaoId: organizacaoRelacaoId,
          },
        });
      } else {
        await tx.relacaoTreinamento.create({
          data: relacaoShape,
        });
      }

      if (ids.atletaId && ids.clubeId) {
        await tx.atleta.update({
          where: { id: ids.atletaId },
          data: { clubeId: ids.clubeId },
        });

        const existeVinculo = await tx.vinculoFormacao.findFirst({
          where: {
            atletaId: ids.atletaId,
            origem: "Clube",
            origemId: ids.clubeId,
          },
        });

        if (!existeVinculo) {
          await tx.vinculoFormacao.create({
            data: {
              atletaId: ids.atletaId,
              origem: "Clube",
              origemId: ids.clubeId,
            },
          });
        }
      }

      if (ids.atletaId && ids.escolinhaId) {
        await tx.atleta.update({
          where: { id: ids.atletaId },
          data: { escolinhaId: ids.escolinhaId },
        });

        const existeVinculo = await tx.vinculoFormacao.findFirst({
            where: {
              atletaId: ids.atletaId,
              origem: "Escolinha",
              origemId: ids.escolinhaId,
            },
          });

          if (!existeVinculo) {
            await tx.vinculoFormacao.create({
              data: {
                atletaId: ids.atletaId,
                origem: "Escolinha",
                origemId: ids.escolinhaId,
              },
            });
          }
      }
    });

    await prisma.solicitacaoTreino.delete({ where: { id } });

    await criarNotificacaoEEnviarPush({
      usuarioId: solicitacao.remetenteId,
      actorId: solicitacao.destinatarioId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Vínculo aceito",
      mensagem: "Sua solicitação de treino foi aceita.",
      link: `/perfil/${solicitacao.destinatarioId}`,
    });

    return res.json({
      ok: true,
      message: existente
        ? "Relação já existia. Solicitação removida."
        : "Solicitação aceita com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao aceitar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function recusarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== me) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });

    await criarNotificacaoEEnviarPush({
      usuarioId: solicitacao.remetenteId,
      actorId: me,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Vínculo recusado",
      mensagem: "Sua solicitação de treino foi recusada.",
      link: `/perfil/${me}`,
    });

    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function verificarVinculoTreino(req: Request, res: Response) {
  try {
    const me: string | undefined =
      (req as any).user?.id || (req as any).userId;

    if (!me) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const usuarioAlvoId =
      (req.query.usuarioAlvoId as string) ||
      (req.query.alvoId as string) ||
      (req.query.usuarioId as string);

    const meuPapelRaw = req.query.meuPapel;
    const alvoPapelRaw = req.query.alvoPapel;

    if (!usuarioAlvoId) {
      return res.status(400).json({
        error: "Informe usuarioAlvoId na query string.",
      });
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        id: {
          in: [me, usuarioAlvoId],
        },
      },
      select: {
        id: true,
        tipo: true,
      },
    });

    const uMe = usuarios.find((u) => u.id === me);
    const uAlvo = usuarios.find((u) => u.id === usuarioAlvoId);

    if (!uMe || !uAlvo) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
      });
    }

    const meuPapel =
      normalizarPapelTreino(meuPapelRaw) ??
      normalizarPapelTreino(uMe.tipo);

    const alvoPapel =
      normalizarPapelTreino(alvoPapelRaw) ??
      normalizarPapelTreino(uAlvo.tipo);

    if (!meuPapel || !alvoPapel) {
      return res.status(400).json({
        error: "Papéis inválidos.",
      });
    }

    if (!combinacaoTreinoPermitida(meuPapel, alvoPapel)) {
      return res.json({
        vinculo: false,
        relacaoId: null,
        relacao: null,
        motivo: "Essa combinação de perfis não possui vínculo de treino.",
      });
    }

    const [idsMe, idsAlvo] = await Promise.all([
      getIdsByPapel(uMe.id, meuPapel),
      getIdsByPapel(uAlvo.id, alvoPapel),
    ]);

    if (meuPapel === "Professor" && alvoPapel === "Professor") {
      const idsProf = [idsMe.professorId, idsAlvo.professorId].filter(
        (id): id is string => Boolean(id)
      );

      if (idsProf.length !== 2) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professores não encontrados",
        });
      }

      const [professorAId, professorBId] =
        idsProf[0] < idsProf[1]
          ? [idsProf[0], idsProf[1]]
          : [idsProf[1], idsProf[0]];

      const relacao = await prisma.professorParceiro.findUnique({
        where: {
          professorAId_professorBId: {
            professorAId,
            professorBId,
          },
        },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    if (
      (meuPapel === "Professor" && alvoPapel === "Clube") ||
      (meuPapel === "Clube" && alvoPapel === "Professor")
    ) {
      const professorId = idsMe.professorId || idsAlvo.professorId;
      const clubeId = idsMe.clubeId || idsAlvo.clubeId;

      if (!professorId || !clubeId) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professor ou clube não encontrado",
        });
      }

      const relacao = await prisma.professorClube.findUnique({
        where: {
          professorId_clubeId: {
            professorId,
            clubeId,
          },
        },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    if (
      (meuPapel === "Professor" && alvoPapel === "Escolinha") ||
      (meuPapel === "Escolinha" && alvoPapel === "Professor")
    ) {
      const professorId = idsMe.professorId || idsAlvo.professorId;
      const escolinhaId = idsMe.escolinhaId || idsAlvo.escolinhaId;

      if (!professorId || !escolinhaId) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professor ou escolinha não encontrado",
        });
      }

      const relacao = await prisma.professorEscolinha.findUnique({
        where: {
          professorId_escolinhaId: {
            professorId,
            escolinhaId,
          },
        },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    const atletaId = idsMe.atletaId || idsAlvo.atletaId;
    const professorId = idsMe.professorId || idsAlvo.professorId;
    const clubeId = idsMe.clubeId || idsAlvo.clubeId;
    const escolinhaId = idsMe.escolinhaId || idsAlvo.escolinhaId;

    if (!atletaId) {
      return res.json({
        vinculo: false,
        relacaoId: null,
        relacao: null,
        motivo: "Sem atleta envolvido",
      });
    }

    if (!professorId && !clubeId && !escolinhaId) {
      return res.json({
        vinculo: false,
        relacaoId: null,
        relacao: null,
        motivo: "Sem professor/clube/escolinha envolvido",
      });
    }

    const relacao = await prisma.relacaoTreinamento.findFirst({
      where: {
        atletaId,
        professorId: professorId ?? null,
        clubeId: clubeId ?? null,
        escolinhaId: escolinhaId ?? null,
        ativo: true,
        encerradoEm: null,
      },
    });

    return res.json({
      vinculo: !!relacao,
      relacaoId: relacao?.id ?? null,
      relacao,
    });
  } catch (e) {
    console.error("verificarVinculoTreino erro:", e);
    return res.status(500).json({
      error: "Erro ao verificar vínculo.",
    });
  }
}

export async function desvincularTreino(
  req: Request,
  res: Response
) {
  try {
    const me:
      | string
      | undefined =
      (req as any).user?.id ||
      (req as any).userId;

    const {
      usuarioAlvoId,
      meuPapel: meuPapelRaw,
      alvoPapel: alvoPapelRaw,
    } = req.body ?? {};

    if (!me) {
      return res.status(401).json({
        message:
          "Não autenticado.",
      });
    }

    if (!usuarioAlvoId) {
      return res.status(400).json({
        message:
          "usuarioAlvoId é obrigatório.",
      });
    }

    const [uMe, uAlvo] =
      await Promise.all([
        prisma.usuario.findUnique({
          where: {
            id: me,
          },

          select: {
            id: true,
            tipo: true,
            nomeDeUsuario:
              true,
          },
        }),

        prisma.usuario.findUnique({
          where: {
            id:
              String(
                usuarioAlvoId
              ),
          },

          select: {
            id: true,
            tipo: true,
            nomeDeUsuario:
              true,
          },
        }),
      ]);

    if (!uMe || !uAlvo) {
      return res.status(404).json({
        message:
          "Usuário não encontrado.",
      });
    }

    const meuPapel =
      normalizarPapelTreino(
        meuPapelRaw
      ) ??
      normalizarPapelTreino(
        uMe.tipo
      );

    const alvoPapel =
      normalizarPapelTreino(
        alvoPapelRaw
      ) ??
      normalizarPapelTreino(
        uAlvo.tipo
      );

    if (
      !meuPapel ||
      !alvoPapel
    ) {
      return res.status(400).json({
        message:
          "Papéis inválidos.",
      });
    }

    const [
      idsMe,
      idsAlvo,
    ] =
      await Promise.all([
        getIdsByPapel(
          me,
          meuPapel
        ),

        getIdsByPapel(
          String(
            usuarioAlvoId
          ),
          alvoPapel
        ),
      ]);

    let removeuAlgo =
      false;

    if (
      meuPapel ===
        "Professor" &&
      alvoPapel ===
        "Professor"
    ) {
      const idsProf = [
        idsMe.professorId,
        idsAlvo.professorId,
      ].filter(
        (id): id is string =>
          Boolean(id)
      );

      if (
        idsProf.length === 2
      ) {
        const [
          professorAId,
          professorBId,
        ] =
          idsProf[0] <
          idsProf[1]
            ? [
                idsProf[0],
                idsProf[1],
              ]
            : [
                idsProf[1],
                idsProf[0],
              ];

        const removido =
          await prisma.professorParceiro.deleteMany({
            where: {
              professorAId,
              professorBId,
            },
          });

        removeuAlgo =
          removido.count >
          0;
      }
    }

    else if (
      (meuPapel ===
        "Professor" &&
        alvoPapel ===
          "Clube") ||
      (meuPapel ===
        "Clube" &&
        alvoPapel ===
          "Professor")
    ) {
      const professorId =
        idsMe.professorId ||
        idsAlvo.professorId;

      const clubeId =
        idsMe.clubeId ||
        idsAlvo.clubeId;

      if (
        professorId &&
        clubeId
      ) {
        const removido =
          await prisma.professorClube.deleteMany({
            where: {
              professorId,
              clubeId,
            },
          });

        removeuAlgo =
          removido.count >
          0;

        if (removeuAlgo) {
          await prisma.professor.updateMany({
            where: {
              id:
                professorId,
              clubeId,
            },

            data: {
              clubeId:
                null,
            },
          });
        }
      }
    }

    else if (
      (meuPapel ===
        "Professor" &&
        alvoPapel ===
          "Escolinha") ||
      (meuPapel ===
        "Escolinha" &&
        alvoPapel ===
          "Professor")
    ) {
      const professorId =
        idsMe.professorId ||
        idsAlvo.professorId;

      const escolinhaId =
        idsMe.escolinhaId ||
        idsAlvo.escolinhaId;

      if (
        professorId &&
        escolinhaId
      ) {
        const removido =
          await prisma.professorEscolinha.deleteMany({
            where: {
              professorId,
              escolinhaId,
            },
          });

        removeuAlgo =
          removido.count >
          0;

        if (removeuAlgo) {
          await prisma.professor.updateMany({
            where: {
              id:
                professorId,
              escolinhaId,
            },

            data: {
              escolinhaId:
                null,
            },
          });
        }
      }
    }

    else {
      const atletaId =
        idsMe.atletaId ||
        idsAlvo.atletaId;

      const professorId =
        idsMe.professorId ||
        idsAlvo.professorId;

      const clubeId =
        idsMe.clubeId ||
        idsAlvo.clubeId;

      const escolinhaId =
        idsMe.escolinhaId ||
        idsAlvo.escolinhaId;

      if (atletaId) {
        const removido =
          await prisma.relacaoTreinamento.deleteMany({
            where: {
              atletaId,

              professorId:
                professorId ??
                null,

              clubeId:
                clubeId ??
                null,

              escolinhaId:
                escolinhaId ??
                null,

              ativo: true,
              encerradoEm:
                null,
            },
          });

        removeuAlgo =
          removido.count >
          0;

        if (
          removeuAlgo &&
          clubeId
        ) {
          await prisma.atleta.updateMany({
            where: {
              id:
                atletaId,
              clubeId,
            },

            data: {
              clubeId:
                null,
            },
          });

          await prisma.vinculoFormacao.deleteMany({
            where: {
              atletaId,
              origem:
                "Clube",
              origemId:
                clubeId,
            },
          });
        }

        if (
          removeuAlgo &&
          escolinhaId
        ) {
          await prisma.atleta.updateMany({
            where: {
              id:
                atletaId,
              escolinhaId,
            },

            data: {
              escolinhaId:
                null,
            },
          });

          await prisma.vinculoFormacao.deleteMany({
            where: {
              atletaId,
              origem:
                "Escolinha",
              origemId:
                escolinhaId,
            },
          });
        }
      }
    }

    await prisma.solicitacaoTreino.deleteMany({
      where: {
        OR: [
          {
            remetenteId:
              me,

            destinatarioId:
              String(
                usuarioAlvoId
              ),
          },

          {
            remetenteId:
              String(
                usuarioAlvoId
              ),

            destinatarioId:
              me,
          },
        ],
      },
    });

    if (removeuAlgo) {
      await criarNotificacaoEEnviarPush({
        usuarioId:
          String(
            usuarioAlvoId
          ),

        actorId:
          me,

        tipo:
          NotificacaoTipo.TREINO,

        titulo:
          "Vínculo de treino encerrado",

        mensagem:
          `@${
            uMe
              .nomeDeUsuario ??
            "usuario"
          } deixou de treinar junto com você.`,

        link:
          `/perfil/${me}`,
      });
    }

    return res.json({
      ok: true,
      desvinculado:
        removeuAlgo,
    });
  } catch (e) {
    console.error(
      "desvincularTreino",
      e
    );

    return res.status(500).json({
      message:
        "Erro ao desvincular treino.",
    });
  }
}