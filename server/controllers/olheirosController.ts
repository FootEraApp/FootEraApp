import { prisma } from "../prisma.js";
import type { Request, Response } from "express";
import {
  criarNotificacaoEEnviarPush,
  recomputeAndEmitBadge,
} from "./notificacoesController.js";

export async function getIndicacoes(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const lista = await prisma.indicacao.findMany({
      where: { olheiroId: id },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        criadoEm: true,
        status: true,
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
        clube: {
          select: {
            id: true,
            usuarioId: true,
            nome: true,
            logo: true,
          },
        },
        escolinha: {
          select: {
            id: true,
            usuarioId: true,
            nome: true,
            logo: true,
          },
        },
      },
    });

    const itens = (lista || []).map((i) => ({
      id: i.id,
      criadoEm: i.criadoEm,
      status: i.status,
      atleta: {
        id:
          i.atleta?.id ?? "",
        usuarioId:
          i.atleta?.usuarioId ??
          i.atleta?.usuario?.id ??
          null,
        nome:
          i.atleta?.usuario?.nome ||
          i.atleta?.nome ||
          i.atleta?.usuario
            ?.nomeDeUsuario ||
          "Atleta",
        foto:
          i.atleta?.usuario?.foto ??
          i.atleta?.foto ??
          null,
        usuario:
          i.atleta?.usuario ?? null,
      },
      clube: i.clube
        ? {
            id: i.clube.id,
            usuarioId: i.clube.usuarioId ?? null,
            nome: i.clube.nome ?? "",
            logo: i.clube.logo ?? null,
            tipo: "Clube",
          }
        : null,
      escolinha: i.escolinha
        ? {
            id: i.escolinha.id,
            usuarioId: i.escolinha.usuarioId ?? null,
            nome: i.escolinha.nome ?? "",
            logo: i.escolinha.logo ?? null,
            tipo: "Escolinha",
          }
        : null,
    }));

    return res.json(itens);
  } catch (e) {
    console.error("GET /api/olheiros/:id/indicacoes", e);
    return res.status(500).json({ error: "Falha ao carregar indicações do olheiro." });
  }
}

export async function perfilOlheiro(req: Request, res: Response) {
  try {
    let { id } = req.params as { id: string };
    const meTipoUsuarioId = (req as any).user?.tipoUsuarioId as string | undefined;
    const PONTOS_POR_INDICACAO_APROVADA = 10;
    if (id === "me" && meTipoUsuarioId) id = meTipoUsuarioId;

    const olheiro = await prisma.olheiro.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
            configuracoesPrivacidade: true,
          },
        },
        colaboracaoClube: {
          select: { id: true, usuarioId: true, nome: true, logo: true },
        },
        colaboracaoEscolinha: {
          select: {
            id: true,
            usuarioId: true,
            nome: true,
            logo: true,
          },
        },
      },
    });
    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });

    const configuracoesPrivacidade =
      (olheiro.usuario as any)
        .configuracoesPrivacidade;

    const mostrarEmailNoPerfil =
      configuracoesPrivacidade &&
      typeof configuracoesPrivacidade === "object"
        ? configuracoesPrivacidade
            .mostrarEmail === true
        : false;

    const [
      indicacoesTot,
      indicacoesAprov,
    ] = await Promise.all([
      prisma.indicacao.count({
        where: {
          olheiroId: id,
        },
      }),

      prisma.indicacao.count({
        where: {
          olheiroId: id,
          status: "APROVADA",
        },
      }),
    ]);
    const taxaAprov = indicacoesTot > 0 ? indicacoesAprov / indicacoesTot : 0;
    const atletasUnicos = await prisma.indicacao.findMany({
      where: { olheiroId: id },
      select: { atletaId: true },
      distinct: ["atletaId"],
    });

    const reputacaoCalculada =
      indicacoesAprov *
      PONTOS_POR_INDICACAO_APROVADA;

    if (
      Number(olheiro.reputacaoScore ?? 0) !==
        reputacaoCalculada ||
      Number(olheiro.totalIndicacoes ?? 0) !==
        indicacoesTot
    ) {
      await prisma.olheiro.update({
        where: {
          id,
        },

        data: {
          reputacaoScore:
            reputacaoCalculada,

          totalIndicacoes:
            indicacoesTot,
        },
      });
    }

    const payload = {
      tipo: "Olheiro" as const,
      usuario: {
        id: olheiro.usuario.id,
        nome: olheiro.usuario.nome,
        email: mostrarEmailNoPerfil
          ? olheiro.usuario.email
          : null,
        foto: olheiro.usuario.foto,
        nomeDeUsuario: olheiro.usuario.nomeDeUsuario || null,
      },
      olheiro: {
        id: olheiro.id,
        usuarioId: olheiro.usuarioId,
        fotoUrl: olheiro.fotoUrl,
        headline: olheiro.headline,
        descricao: olheiro.descricao,
        areaAtuacao: olheiro.areaAtuacao,
        anosExperiencia: olheiro.anosExperiencia,
        emailPublico:
          mostrarEmailNoPerfil
            ? olheiro.emailPublico
            : null,
        telefonePublico: olheiro.telefonePublico,
        siteOuLinkedin: olheiro.siteOuLinkedin,
        colaboracaoClube: olheiro.colaboracaoClube
          ? {
              id: olheiro.colaboracaoClube.id,
              usuarioId: olheiro.colaboracaoClube.usuarioId,
              nome: olheiro.colaboracaoClube.nome,
              logo: olheiro.colaboracaoClube.logo,
            }
          : null,
        colaboracaoEscolinha: olheiro.colaboracaoEscolinha
          ? {
              id: olheiro.colaboracaoEscolinha.id,
              usuarioId:
                olheiro.colaboracaoEscolinha.usuarioId,
              nome:
                olheiro.colaboracaoEscolinha.nome,
              logo:
                olheiro.colaboracaoEscolinha.logo,
            }
          : null,
        reputacaoScore: reputacaoCalculada,
        totalIndicacoes: olheiro.totalIndicacoes,
      },
      metrics: {
        atletasAcompanhados: atletasUnicos.length,
        indicacoesEnviadas: indicacoesTot,
        reputacaoScore: reputacaoCalculada,
        indicacoesAprovadas: indicacoesAprov,
        taxaAprovacao: taxaAprov,
        atletasAssinados: null,
      },
    };

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/perfil/olheiro/:id", e);
    return res.status(500).json({ error: "Falha ao carregar perfil do olheiro." });
  }
}

export async function getNota(req: Request, res: Response) {
  try {
    const usuarioId = (req as any).userId as string;
    const { atletaId } = req.params as { atletaId: string };

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!olheiro) return res.status(403).json({ error: "Somente olheiros podem usar notas" });

    const nota = await prisma.scoutNote.findUnique({
      where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
    });
    res.json(nota ?? { texto: "", lastScoreSeen: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao carregar nota" });
  }
}

export async function setNota(req: Request, res: Response) {
  try {
    const usuarioId = (req as any).userId as string;
    const { atletaId } = req.params as { atletaId: string };
    const { texto, lastScoreSeen } = (req.body ?? {}) as {
      texto?: string;
      lastScoreSeen?: number | null;
    };

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!olheiro) return res.status(403).json({ error: "Somente olheiros podem usar notas" });

    const saved = await prisma.scoutNote.upsert({
      where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
      create: {
        olheiroId: olheiro.id,
        atletaId,
        texto: texto ?? "",
        lastScoreSeen: lastScoreSeen ?? null,
      },
      update: {
        texto: texto ?? "",
        lastScoreSeen: lastScoreSeen ?? undefined,
      },
    });
    res.json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao salvar nota" });
  }
}

type DestinoColaboracaoTipo =
  | "CLUBE"
  | "ESCOLINHA";

function getUsuarioAutenticadoId(
  req: Request
) {
  return String(
    (req as any).userId ||
      (req as any).user?.id ||
      ""
  ).trim();
}

async function resolverDestinoColaboracao(
  tipo: DestinoColaboracaoTipo,
  destinoId: string
) {
  if (tipo === "CLUBE") {
    const clube =
      await prisma.clube.findUnique({
        where: {
          id: destinoId,
        },
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          logo: true,
        },
      });

    if (!clube) return null;

    return {
      id: clube.id,
      usuarioId: clube.usuarioId,
      nome: clube.nome,
      logo: clube.logo,
      tipo: "CLUBE" as const,
    };
  }

  const escolinha =
    await prisma.escolinha.findUnique({
      where: {
        id: destinoId,
      },
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        logo: true,
      },
    });

  if (!escolinha) return null;

  return {
    id: escolinha.id,
    usuarioId: escolinha.usuarioId,
    nome: escolinha.nome,
    logo: escolinha.logo,
    tipo: "ESCOLINHA" as const,
  };
}

export async function getMinhaColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    if (!usuarioId) {
      return res
        .status(401)
        .json({
          error: "Não autenticado.",
        });
    }

    const { id } =
      req.params as {
        id: string;
      };

    const olheiro =
      await prisma.olheiro.findUnique({
        where: {
          id,
        },
        include: {
          colaboracaoClube: {
            select: {
              id: true,
              usuarioId: true,
              nome: true,
              logo: true,
            },
          },

          colaboracaoEscolinha: {
            select: {
              id: true,
              usuarioId: true,
              nome: true,
              logo: true,
            },
          },
        },
      });

    if (!olheiro) {
      return res
        .status(404)
        .json({
          error:
            "Olheiro não encontrado.",
        });
    }

    if (
      olheiro.usuarioId !==
      usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Você não pode editar a colaboração deste olheiro.",
        });
    }

    let atual: any = null;

    if (
      olheiro.colaboracaoClube
    ) {
      atual = {
        tipo: "CLUBE",
        id:
          olheiro
            .colaboracaoClube.id,
        usuarioId:
          olheiro
            .colaboracaoClube
            .usuarioId,
        nome:
          olheiro
            .colaboracaoClube.nome,
        logo:
          olheiro
            .colaboracaoClube.logo,
      };
    } else if (
      olheiro.colaboracaoEscolinha
    ) {
      atual = {
        tipo: "ESCOLINHA",
        id:
          olheiro
            .colaboracaoEscolinha.id,
        usuarioId:
          olheiro
            .colaboracaoEscolinha
            .usuarioId,
        nome:
          olheiro
            .colaboracaoEscolinha
            .nome,
        logo:
          olheiro
            .colaboracaoEscolinha
            .logo,
      };
    }

    const solicitacao =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findFirst({
          where: {
            olheiroId:
              olheiro.id,
            status:
              "PENDENTE",
          },
          orderBy: {
            criadaEm: "desc",
          },
        });

    let pendente: any =
      null;

    if (solicitacao) {
      const destino =
        await resolverDestinoColaboracao(
          solicitacao.destinoTipo as DestinoColaboracaoTipo,
          solicitacao.destinoId
        );

      pendente = {
        id:
          solicitacao.id,
        tipo:
          solicitacao.destinoTipo,
        destinoId:
          solicitacao.destinoId,
        nome:
          destino?.nome ||
          "Organização",
        logo:
          destino?.logo ||
          null,
        criadaEm:
          solicitacao.criadaEm,
      };
    }

    return res.json({
      atual,
      pendente,
    });
  } catch (e) {
    console.error(
      "GET colaboração olheiro:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao carregar colaboração.",
      });
  }
}

export async function solicitarColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    if (!usuarioId) {
      return res
        .status(401)
        .json({
          error:
            "Não autenticado.",
        });
    }

    const { id } =
      req.params as {
        id: string;
      };

    const tipoRaw =
      String(
        req.body?.tipo ||
          ""
      )
        .trim()
        .toUpperCase();

    const destinoId =
      String(
        req.body?.destinoId ||
          ""
      ).trim();

    if (
      tipoRaw !== "CLUBE" &&
      tipoRaw !==
        "ESCOLINHA"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Tipo de colaboração inválido.",
        });
    }

    if (!destinoId) {
      return res
        .status(400)
        .json({
          error:
            "Informe a organização.",
        });
    }

    const tipo =
      tipoRaw as DestinoColaboracaoTipo;

    const olheiro =
      await prisma.olheiro.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          usuarioId: true,
          colaboracaoClubeId:
            true,
          colaboracaoEscolinhaId:
            true,
          usuario: {
            select: {
              nome: true,
            },
          },
        },
      });

    if (!olheiro) {
      return res
        .status(404)
        .json({
          error:
            "Olheiro não encontrado.",
        });
    }

    if (
      olheiro.usuarioId !==
      usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Você não pode solicitar colaboração por este perfil.",
        });
    }

    const destino =
      await resolverDestinoColaboracao(
        tipo,
        destinoId
      );

    if (!destino) {
      return res
        .status(404)
        .json({
          error:
            tipo === "CLUBE"
              ? "Clube não encontrado."
              : "Escolinha não encontrada.",
        });
    }

    if (
      !destino.usuarioId
    ) {
      return res
        .status(400)
        .json({
          error:
            "A organização escolhida não possui usuário responsável.",
        });
    }

    const jaAtual =
      tipo === "CLUBE"
        ? olheiro.colaboracaoClubeId ===
          destinoId
        : olheiro.colaboracaoEscolinhaId ===
          destinoId;

    if (jaAtual) {
      return res
        .status(409)
        .json({
          error:
            "Você já colabora com esta organização.",
        });
    }

    const pendentes =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findMany({
          where: {
            olheiroId:
              olheiro.id,
            status:
              "PENDENTE",
          },
        });

    const igual =
      pendentes.find(
        (s) =>
          s.destinoTipo ===
            tipo &&
          s.destinoId ===
            destinoId
      );

    if (igual) {
      return res.json({
        ok: true,
        jaExistia: true,
        solicitacao: igual,
      });
    }

    const notificacoesAntigas =
      pendentes
        .map(
          (s) =>
            s.notificacaoId
        )
        .filter(
          Boolean
        ) as string[];

    if (
      pendentes.length >
      0
    ) {
      await prisma.$transaction(
        [
          prisma
            .solicitacaoColaboracaoOlheiro
            .updateMany({
              where: {
                olheiroId:
                  olheiro.id,
                status:
                  "PENDENTE",
              },
              data: {
                status:
                  "CANCELADA",
                respondidaEm:
                  new Date(),
              },
            }),

          ...(notificacoesAntigas
            .length
            ? [
                prisma
                  .notificacao
                  .deleteMany({
                    where: {
                      id: {
                        in: notificacoesAntigas,
                      },
                    },
                  }),
              ]
            : []),
        ]
      );

      const usuariosAfetados =
        Array.from(
          new Set(
            pendentes.map(
              (p) =>
                p.destinoUsuarioId
            )
          )
        );

      for (
        const alvoUsuarioId of
        usuariosAfetados
      ) {
        await recomputeAndEmitBadge(
          alvoUsuarioId
        );
      }
    }

    const solicitacao =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .create({
          data: {
            olheiroId:
              olheiro.id,

            olheiroUsuarioId:
              olheiro.usuarioId,

            destinoTipo:
              tipo,

            destinoId:
              destino.id,

            destinoUsuarioId:
              destino.usuarioId,

            status:
              "PENDENTE",
          },
        });

    const notificacao =
      await criarNotificacaoEEnviarPush({
        usuarioId:
          destino.usuarioId,

        actorId:
          olheiro.usuarioId,

        tipo:
          "COLABORACAO_OLHEIRO",

        titulo:
          "Pedido de colaboração",

        mensagem:
          `${olheiro.usuario.nome} quer colaborar com ${
            tipo === "CLUBE"
              ? "seu clube"
              : "sua escola"
          }.`,

        link:
          `/notificacoes?colaboracaoId=${encodeURIComponent(
            solicitacao.id
          )}`,
      });

    await prisma
      .solicitacaoColaboracaoOlheiro
      .update({
        where: {
          id:
            solicitacao.id,
        },
        data: {
          notificacaoId:
            notificacao.id,
        },
      });

    return res
      .status(201)
      .json({
        ok: true,
        solicitacao: {
          id:
            solicitacao.id,
          tipo,
          destinoId:
            destino.id,
          nome:
            destino.nome,
          status:
            "PENDENTE",
        },
      });
  } catch (e) {
    console.error(
      "POST solicitar colaboração:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao enviar solicitação de colaboração.",
      });
  }
}

export async function removerColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    const { id } =
      req.params as {
        id: string;
      };

    const olheiro =
      await prisma.olheiro.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          usuarioId: true,
        },
      });

    if (!olheiro) {
      return res
        .status(404)
        .json({
          error:
            "Olheiro não encontrado.",
        });
    }

    if (
      !usuarioId ||
      olheiro.usuarioId !==
        usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Você não pode remover esta colaboração.",
        });
    }

    await prisma.olheiro.update({
      where: {
        id,
      },
      data: {
        colaboracaoClubeId:
          null,
        colaboracaoEscolinhaId:
          null,
      },
    });

    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error(
      "DELETE colaboração:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao remover colaboração.",
      });
  }
}

export async function cancelarSolicitacaoColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    const {
      id,
      solicitacaoId,
    } =
      req.params as {
        id: string;
        solicitacaoId: string;
      };

    const solicitacao =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findUnique({
          where: {
            id:
              solicitacaoId,
          },
        });

    if (!solicitacao) {
      return res
        .status(404)
        .json({
          error:
            "Solicitação não encontrada.",
        });
    }

    if (
      solicitacao.olheiroId !==
        id ||
      solicitacao
        .olheiroUsuarioId !==
        usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Você não pode cancelar esta solicitação.",
        });
    }

    if (
      solicitacao.status !==
      "PENDENTE"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Esta solicitação já foi respondida.",
        });
    }

    await prisma.$transaction(
      [
        prisma
          .solicitacaoColaboracaoOlheiro
          .update({
            where: {
              id:
                solicitacao.id,
            },
            data: {
              status:
                "CANCELADA",
              respondidaEm:
                new Date(),
            },
          }),

        ...(solicitacao
          .notificacaoId
          ? [
              prisma
                .notificacao
                .deleteMany({
                  where: {
                    id:
                      solicitacao
                        .notificacaoId,
                  },
                }),
            ]
          : []),
      ]
    );

    await recomputeAndEmitBadge(
      solicitacao.destinoUsuarioId
    );

    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error(
      "Cancelar colaboração:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao cancelar solicitação.",
      });
  }
}

export async function aceitarSolicitacaoColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    const {
      solicitacaoId,
    } =
      req.params as {
        solicitacaoId: string;
      };

    const solicitacao =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findUnique({
          where: {
            id:
              solicitacaoId,
          },
        });

    if (!solicitacao) {
      return res
        .status(404)
        .json({
          error:
            "Solicitação não encontrada.",
        });
    }

    if (
      solicitacao
        .destinoUsuarioId !==
      usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Esta solicitação não pertence ao seu perfil.",
        });
    }

    if (
      solicitacao.status !==
      "PENDENTE"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Esta solicitação já foi respondida.",
        });
    }

    const tipo =
      solicitacao
        .destinoTipo as DestinoColaboracaoTipo;

    const destino =
      await resolverDestinoColaboracao(
        tipo,
        solicitacao.destinoId
      );

    if (
      !destino ||
      destino.usuarioId !==
        usuarioId
    ) {
      return res
        .status(404)
        .json({
          error:
            "Organização não encontrada.",
        });
    }

    const outrasPendentes =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findMany({
          where: {
            olheiroId:
              solicitacao.olheiroId,

            status:
              "PENDENTE",

            id: {
              not:
                solicitacao.id,
            },
          },
        });

    const notificacaoIds =
      [
        solicitacao.notificacaoId,
        ...outrasPendentes.map(
          (p) =>
            p.notificacaoId
        ),
      ].filter(
        Boolean
      ) as string[];

    await prisma.$transaction(
      async (tx) => {
        await tx.olheiro.update({
          where: {
            id:
              solicitacao.olheiroId,
          },

          data: {
            colaboracaoClubeId:
              tipo === "CLUBE"
                ? solicitacao.destinoId
                : null,

            colaboracaoEscolinhaId:
              tipo ===
              "ESCOLINHA"
                ? solicitacao.destinoId
                : null,
          },
        });

        await tx
          .solicitacaoColaboracaoOlheiro
          .update({
            where: {
              id:
                solicitacao.id,
            },
            data: {
              status:
                "ACEITA",
              respondidaEm:
                new Date(),
            },
          });

        await tx
          .solicitacaoColaboracaoOlheiro
          .updateMany({
            where: {
              olheiroId:
                solicitacao.olheiroId,

              status:
                "PENDENTE",

              id: {
                not:
                  solicitacao.id,
              },
            },
            data: {
              status:
                "CANCELADA",
              respondidaEm:
                new Date(),
            },
          });

        if (
          notificacaoIds.length
        ) {
          await tx
            .notificacao
            .deleteMany({
              where: {
                id: {
                  in:
                    notificacaoIds,
                },
              },
            });
        }
      }
    );

    const usuariosBadge =
      Array.from(
        new Set([
          solicitacao
            .destinoUsuarioId,

          ...outrasPendentes.map(
            (p) =>
              p.destinoUsuarioId
          ),
        ])
      );

    for (
      const alvoUsuarioId of
      usuariosBadge
    ) {
      await recomputeAndEmitBadge(
        alvoUsuarioId
      );
    }

    await criarNotificacaoEEnviarPush({
      usuarioId:
        solicitacao
          .olheiroUsuarioId,

      actorId:
        usuarioId,

      tipo:
        "COLABORACAO_RESPONDIDA",

      titulo:
        "Colaboração aceita",

      mensagem:
        `${destino.nome} aceitou colaborar com você.`,

      link:
        `/perfil/${encodeURIComponent(
          destino.usuarioId
        )}`,
    });

    return res.json({
      ok: true,
      status:
        "ACEITA",
    });
  } catch (e) {
    console.error(
      "Aceitar colaboração:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao aceitar colaboração.",
      });
  }
}

export async function recusarSolicitacaoColaboracao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioAutenticadoId(req);

    const {
      solicitacaoId,
    } =
      req.params as {
        solicitacaoId: string;
      };

    const solicitacao =
      await prisma
        .solicitacaoColaboracaoOlheiro
        .findUnique({
          where: {
            id:
              solicitacaoId,
          },
        });

    if (!solicitacao) {
      return res
        .status(404)
        .json({
          error:
            "Solicitação não encontrada.",
        });
    }

    if (
      solicitacao
        .destinoUsuarioId !==
      usuarioId
    ) {
      return res
        .status(403)
        .json({
          error:
            "Esta solicitação não pertence ao seu perfil.",
        });
    }

    if (
      solicitacao.status !==
      "PENDENTE"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Esta solicitação já foi respondida.",
        });
    }

    const tipo =
      solicitacao
        .destinoTipo as DestinoColaboracaoTipo;

    const destino =
      await resolverDestinoColaboracao(
        tipo,
        solicitacao.destinoId
      );

    await prisma.$transaction(
      [
        prisma
          .solicitacaoColaboracaoOlheiro
          .update({
            where: {
              id:
                solicitacao.id,
            },
            data: {
              status:
                "RECUSADA",
              respondidaEm:
                new Date(),
            },
          }),

        ...(solicitacao
          .notificacaoId
          ? [
              prisma
                .notificacao
                .deleteMany({
                  where: {
                    id:
                      solicitacao
                        .notificacaoId,
                  },
                }),
            ]
          : []),
      ]
    );

    await recomputeAndEmitBadge(
      usuarioId
    );

    await criarNotificacaoEEnviarPush({
      usuarioId:
        solicitacao
          .olheiroUsuarioId,

      actorId:
        usuarioId,

      tipo:
        "COLABORACAO_RESPONDIDA",

      titulo:
        "Colaboração recusada",

      mensagem:
        `${destino?.nome || "A organização"} recusou o pedido de colaboração.`,

      link:
        "/perfil",
    });

    return res.json({
      ok: true,
      status:
        "RECUSADA",
    });
  } catch (e) {
    console.error(
      "Recusar colaboração:",
      e
    );

    return res
      .status(500)
      .json({
        error:
          "Falha ao recusar colaboração.",
      });
  }
}

export async function patchColaboracao(
  req: Request,
  res: Response
) {
  const querCriarDireto =
    req.body?.colaboracaoClubeId !=
      null ||
    req.body
      ?.colaboracaoEscolinhaId !=
      null;

  if (querCriarDireto) {
    return res
      .status(409)
      .json({
        error:
          "A colaboração precisa ser aceita pela organização.",
        code:
          "COLABORACAO_REQUER_APROVACAO",
      });
  }

  return removerColaboracao(
    req,
    res
  );
}