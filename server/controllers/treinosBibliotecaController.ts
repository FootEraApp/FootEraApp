import type {
  Request,
  Response,
} from "express";

import {
  TipoUsuario,
  StatusResponsavelAtleta,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  getActiveContext,
} from "../services/activeContext.js";

type AuthenticatedRequest =
  Request & {
    userId?: string;
  };

async function resolverAtletaBiblioteca(
  referencia: string
) {
  const ref =
    String(
      referencia ?? ""
    ).trim();

  if (!ref) {
    return null;
  }

  return prisma.atleta.findFirst({
    where: {
      OR: [
        {
          id:
            ref,
        },

        {
          usuarioId:
            ref,
        },
      ],
    },

    select: {
      id:
        true,

      usuarioId:
        true,
    },
  });
}

async function resolverUsuarioBiblioteca(
  req: AuthenticatedRequest
) {
  const usuarioLogadoId =
    String(
      req.userId ?? ""
    ).trim();

  if (!usuarioLogadoId) {
    return null;
  }

  const contexto =
    await getActiveContext(
      usuarioLogadoId
    );

  if (
    !contexto ||
    contexto.kind !==
      "PERSONAL"
  ) {
    return null;
  }

  /*
   * Atleta:
   * biblioteca pertence ao próprio usuário.
   */
  if (
    contexto.tipoUsuario ===
    TipoUsuario.Atleta
  ) {
    const atleta =
      await prisma.atleta.findUnique({
        where: {
          usuarioId:
            usuarioLogadoId,
        },

        select: {
          id: true,
          usuarioId: true,
        },
      });

    if (!atleta) {
      return null;
    }

    return {
      atletaId:
        atleta.id,

      usuarioId:
        atleta.usuarioId,

      comoResponsavel:
        false,
    };
  }

  /*
   * Responsável:
   * precisa informar a criança.
   */
  if (
    contexto.tipoUsuario ===
    TipoUsuario.Responsavel
  ) {
    const atletaId =
      String(
        req.query
          ?.atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return null;
    }

    const atletaAlvo =
      await resolverAtletaBiblioteca(
        atletaId
      );

    if (!atletaAlvo) {
      return null;
    }

    const vinculo =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId:
                  usuarioLogadoId,

                atletaId:
                  atletaAlvo.id,
              },
          },

          include: {
            atleta: {
              select: {
                id: true,
                usuarioId: true,
              },
            },
          },
        });

    if (
      !vinculo ||
      vinculo.status !==
        StatusResponsavelAtleta.ATIVO
    ) {
      return null;
    }

    const podeGerenciarTreinos =
      vinculo.principal ===
        true ||
      vinculo
        .podeGerenciarTreinos ===
        true;

    if (
      !podeGerenciarTreinos
    ) {
      return null;
    }

    return {
      atletaId:
        vinculo.atleta.id,

      usuarioId:
        vinculo.atleta
          .usuarioId,

      comoResponsavel:
        true,
    };
  }

  return null;
}

// GET /api/treinos/biblioteca
export async function listarMinhaBiblioteca(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const alvo =
      await resolverUsuarioBiblioteca(
        req
      );

    if (!alvo) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui permissão para acessar esta biblioteca.",
        });
    }

    const salvos =
      await prisma
        .treinoSalvo
        .findMany({
          where: {
            usuarioId:
              alvo.usuarioId,

            professorId:
              null,

            clubeId:
              null,

            escolinhaId:
              null,

            OR: [
              {
                expiraEm:
                  null,
              },

              {
                expiraEm: {
                  gt:
                    new Date(),
                },
              },
            ],
          },

          select: {
            id: true,
            titulo: true,
            treinoProgramadoId:
              true,
            createdAt: true,
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

    const ids = [
      ...new Set(
        salvos.map(
          (salvo) =>
            salvo
              .treinoProgramadoId
        )
      ),
    ];

    const programados =
      ids.length
        ? await prisma
            .treinoProgramado
            .findMany({
              where: {
                id: {
                  in:
                    ids,
                },
              },

              include: {
                exercicios: {
                  include: {
                    exercicio:
                      true,

                    exercicioPersonalizado:
                      true,

                    exercicioTemporario:
                      true,
                  },
                },

                professores: {
                  include: {
                    professor: {
                      select: {
                        id:
                          true,

                        nome:
                          true,
                      },
                    },
                  },
                },

                Professor: {
                  select: {
                    id:
                      true,

                    nome:
                      true,
                  },
                },

                clube: {
                  select: {
                    id:
                      true,

                    nome:
                      true,
                  },
                },

                escolinha: {
                  select: {
                    id:
                      true,

                    nome:
                      true,
                  },
                },

                sessaoTreino:
                  true,
              },
            })
        : [];

    const porId =
      new Map(
        programados.map(
          (treino) => [
            treino.id,
            treino,
          ]
        )
      );

    const items =
      salvos.flatMap(
        (salvo) => {
          const treinoProgramado =
            porId.get(
              salvo
                .treinoProgramadoId
            );

          return treinoProgramado
            ? [
                {
                  ...salvo,
                  treinoProgramado,
                },
              ]
            : [];
        }
      );

    return res.json({
      items,
    });
  } catch (erro) {
    console.error(
      "listarMinhaBiblioteca",
      erro
    );

    return res
      .status(500)
      .json({
        message:
          "Erro ao carregar treinos salvos.",
      });
  }
}

// DELETE /api/treinos/biblioteca/:treinoProgramadoId
export async function removerDaMinhaBiblioteca(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const alvo =
      await resolverUsuarioBiblioteca(
        req
      );

    if (!alvo) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui permissão para alterar esta biblioteca.",
        });
    }

    const treinoProgramadoId =
      String(
        req.params
          ?.treinoProgramadoId ??
        ""
      ).trim();

    if (!treinoProgramadoId) {
      return res
        .status(400)
        .json({
          code:
            "TREINO_PROGRAMADO_REQUIRED",

          message:
            "Treino inválido.",
        });
    }

    /*
     * Procuramos especificamente
     * na biblioteca pessoal do atleta.
     */
    const salvo =
      await prisma
        .treinoSalvo
        .findFirst({
          where: {
            usuarioId:
              alvo.usuarioId,

            treinoProgramadoId,

            professorId:
              null,

            clubeId:
              null,

            escolinhaId:
              null,
          },

          select: {
            id:
              true,

            treinoProgramadoId:
              true,
          },
        });

    if (!salvo) {
      return res
        .status(404)
        .json({
          code:
            "TREINO_NOT_SAVED",

          message:
            "Este treino não está salvo na biblioteca.",
        });
    }

    await prisma
      .treinoSalvo
      .delete({
        where: {
          id:
            salvo.id,
        },
      });

    return res.json({
      ok:
        true,

      treinoProgramadoId,

      message:
        "Treino removido dos salvos.",
    });
  } catch (erro) {
    console.error(
      "removerDaMinhaBiblioteca",
      erro
    );

    return res
      .status(500)
      .json({
        message:
          "Erro ao remover treino dos salvos.",
      });
  }
}