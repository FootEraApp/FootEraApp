import type {
  Request,
  Response,
} from "express";

import {
  Categoria,
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  getActiveContext,
} from "../services/activeContext.js";

import {
  canPermission,
} from "../services/permissions.js";

const MAX_SLOTS = 5;
const TTL_DIAS = 30;

type OwnerTreinoSalvo = {
  professorId?: string;
  clubeId?: string;
  escolinhaId?: string;
};

type ContextoTreinoSalvo = {
  usuarioId: string;
  isAdmin: boolean;

  owner:
    OwnerTreinoSalvo;

  /*
   * Professor que está efetivamente
   * usando o contexto.
   *
   * Pode existir inclusive dentro
   * de uma organização:
   *
   * Clube X — Professor
   */
  professorAtivoId:
    string | null;
};

function addDays(
  d: Date,
  days: number
) {
  const x =
    new Date(d);

  x.setDate(
    x.getDate() +
    days
  );

  return x;
}

/*
 * Compatibilidade EXCLUSIVA para Admin.
 *
 * Usuário normal nunca terá o dono
 * escolhido pelo body/query.
 */
function ownerFromExplicit(
  tipoUsuario?: unknown,
  tipoUsuarioId?: unknown
): OwnerTreinoSalvo {
  const tipo =
    String(
      tipoUsuario ??
      ""
    )
      .trim()
      .toLowerCase();

  const id =
    String(
      tipoUsuarioId ??
      ""
    ).trim();

  if (!tipo || !id) {
    return {};
  }

  if (
    tipo ===
    "professor"
  ) {
    return {
      professorId:
        id,
    };
  }

  if (
    tipo ===
    "clube"
  ) {
    return {
      clubeId:
        id,
    };
  }

  if (
    tipo ===
      "escolinha" ||
    tipo ===
      "escola"
  ) {
    return {
      escolinhaId:
        id,
    };
  }

  return {};
}

function ownerValido(
  owner:
    OwnerTreinoSalvo
) {
  return (
    [
      owner.professorId,
      owner.clubeId,
      owner.escolinhaId,
    ].filter(Boolean)
      .length === 1
  );
}

function treinoPertenceAoOwner(
  treino: {
    professorId?:
      string | null;

    clubeId?:
      string | null;

    escolinhaId?:
      string | null;
  },

  owner:
    OwnerTreinoSalvo
) {
  if (
    owner.professorId
  ) {
    return (
      treino.professorId ===
      owner.professorId
    );
  }

  if (
    owner.clubeId
  ) {
    return (
      treino.clubeId ===
      owner.clubeId
    );
  }

  if (
    owner.escolinhaId
  ) {
    return (
      treino.escolinhaId ===
      owner.escolinhaId
    );
  }

  return false;
}

async function resolverContextoTreinoSalvo(
  req: Request,
  explicit?: {
    tipoUsuario?: unknown;
    tipoUsuarioId?: unknown;
  }
): Promise<
  ContextoTreinoSalvo | null
> {
  const usuarioId =
    String(
      (req as any).userId ??
      (req as any).usuarioId ??
      (req as any).user?.id ??
      ""
    ).trim();

  if (!usuarioId) {
    return null;
  }

  const isAdmin =
    await canPermission(
      usuarioId,
      "VER_ADMIN"
    );

  /*
   * Admin pode continuar escolhendo
   * explicitamente um owner.
   */
  if (isAdmin) {
    return {
      usuarioId,

      isAdmin:
        true,

      owner:
        ownerFromExplicit(
          explicit?.tipoUsuario,
          explicit?.tipoUsuarioId
        ),

      professorAtivoId:
        null,
    };
  }

  const contexto =
    await getActiveContext(
      usuarioId
    );

  if (!contexto) {
    return null;
  }

  const podeCriarTreino =
    await canPermission(
      usuarioId,
      "CRIAR_TREINO"
    );

  if (!podeCriarTreino) {
    return null;
  }

  /*
   * Professor pessoal.
   */
  if (
    contexto.kind ===
      "PERSONAL" &&
    contexto.tipoUsuario ===
      TipoUsuario.Professor &&
    contexto.tipoUsuarioId
  ) {
    return {
      usuarioId,

      isAdmin:
        false,

      owner: {
        professorId:
          String(
            contexto.tipoUsuarioId
          ),
      },

      professorAtivoId:
        String(
          contexto.tipoUsuarioId
        ),
    };
  }

  /*
   * Contexto de organização.
   *
   * O treino salvo pertence
   * à organização ativa.
   */
  if (
    contexto.kind ===
      "ORGANIZATION" &&
    contexto
      .legacyOrganizationId
  ) {
    const legacyId =
      String(
        contexto
          .legacyOrganizationId
      );

    const professorAtivoId =
      contexto.tipoUsuario ===
        TipoUsuario.Professor &&
      contexto.tipoUsuarioId
        ? String(
            contexto
              .tipoUsuarioId
          )
        : null;

    if (
      contexto.organizationType ===
      TipoOrganizacao.CLUBE
    ) {
      return {
        usuarioId,

        isAdmin:
          false,

        owner: {
          clubeId:
            legacyId,
        },

        professorAtivoId,
      };
    }

    if (
      contexto.organizationType ===
      TipoOrganizacao.ESCOLA
    ) {
      return {
        usuarioId,

        isAdmin:
          false,

        owner: {
          escolinhaId:
            legacyId,
        },

        professorAtivoId,
      };
    }
  }

  return null;
}

export const criarTreinoSalvo =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        titulo,
        descricao,
        nivel,
        tipoTreino,
        categoria,
        duracao,
        dicas,
        conteudo,
        publico,
        parceiro,
        naoExpira,

        /*
         * Mantidos temporariamente
         * para Admin e compatibilidade
         * do front legado.
         */
        tipoUsuario,
        tipoUsuarioId,

        treinoProgramadoId,
        apagarTreinoSalvoId,
      } =
        req.body ??
        {};

      const contexto =
        await resolverContextoTreinoSalvo(
          req,
          {
            tipoUsuario,
            tipoUsuarioId,
          }
        );

      if (!contexto) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O contexto ativo não pode salvar treinos.",
        });
      }

      let owner =
        contexto.owner;

      /*
       * Admin precisa indicar
       * explicitamente para quem
       * está salvando.
       */
      if (
        contexto.isAdmin &&
        !ownerValido(owner)
      ) {
        return res.status(400).json({
          message:
            "Informe um dono válido para o treino salvo.",
        });
      }

      /*
       * Para usuário comum,
       * owner veio exclusivamente
       * do activeContext.
       */
      if (
        !contexto.isAdmin &&
        !ownerValido(owner)
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O contexto ativo não possui um dono válido para este treino.",
        });
      }

      if (
        !titulo ||
        !conteudo?.exercicios ||
        !Array.isArray(
          conteudo.exercicios
        ) ||
        conteudo.exercicios
          .length === 0
      ) {
        return res.status(400).json({
          message:
            "Título e pelo menos 1 exercício são obrigatórios.",
        });
      }

      const expiraEm =
        publico ||
        naoExpira
          ? null
          : addDays(
              new Date(),
              TTL_DIAS
            );

      const effectiveTreinoProgramadoId =
        treinoProgramadoId ??
        `tpl_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      const created =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Quando o usuário escolhe
             * substituir um dos 5 slots,
             * só pode apagar do contexto
             * ativo.
             */
            if (
              apagarTreinoSalvoId
            ) {
              await tx
                .treinoSalvo
                .deleteMany({
                  where: {
                    id:
                      String(
                        apagarTreinoSalvoId
                      ),

                    usuarioId:
                      contexto.usuarioId,

                    ...owner,
                  },
                });
            }

            const ativos =
              await tx
                .treinoSalvo
                .findMany({
                  where: {
                    usuarioId:
                      contexto.usuarioId,

                    ...owner,

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
                    id:
                      true,

                    treinoProgramadoId:
                      true,

                    createdAt:
                      true,

                    titulo:
                      true,
                  },

                  orderBy: {
                    createdAt:
                      "desc",
                  },

                  take:
                    200,
                });

            const idsProgramados =
              Array.from(
                new Set(
                  ativos
                    .map((a) =>
                      String(
                        a.treinoProgramadoId
                      )
                    )
                    .filter(Boolean)
                )
              );

            const existentes =
              idsProgramados.length
                ? await tx
                    .treinoProgramado
                    .findMany({
                      where: {
                        id: {
                          in:
                            idsProgramados,
                        },
                      },

                      select: {
                        id:
                          true,
                      },
                    })
                : [];

            const setExistentes =
              new Set(
                existentes.map(
                  (e) =>
                    e.id
                )
              );

            const orfaos =
              ativos.filter(
                (a) =>
                  !setExistentes.has(
                    String(
                      a.treinoProgramadoId
                    )
                  )
              );

            if (
              orfaos.length
            ) {
              await tx
                .treinoSalvo
                .deleteMany({
                  where: {
                    usuarioId:
                      contexto.usuarioId,

                    ...owner,

                    id: {
                      in:
                        orfaos.map(
                          (o) =>
                            o.id
                        ),
                    },
                  },
                });
            }

            const ativosCount =
              ativos.length -
              orfaos.length;

            if (
              !publico &&
              ativosCount >=
                MAX_SLOTS
            ) {
              const validosOrdenados =
                ativos
                  .filter(
                    (a) =>
                      setExistentes.has(
                        String(
                          a.treinoProgramadoId
                        )
                      )
                  )
                  .slice(
                    0,
                    50
                  );

              (
                res as any
              ).__limitPayload = {
                code:
                  "LIMIT_TREINOS_SALVOS",

                message:
                  `Você já possui ${MAX_SLOTS} treinos salvos. Escolha um para apagar.`,

                meus:
                  validosOrdenados.map(
                    (t) => ({
                      id:
                        t.id,

                      createdAt:
                        t.createdAt,

                      nome:
                        t.titulo,

                      treinoProgramadoId:
                        t.treinoProgramadoId,
                    })
                  ),
              };

              return null;
            }

            return tx
              .treinoSalvo
              .create({
                data: {
                  usuarioId:
                    contexto.usuarioId,

                  treinoProgramadoId:
                    String(
                      effectiveTreinoProgramadoId
                    ),

                  titulo,

                  descricao:
                    descricao ??
                    null,

                  nivel:
                    nivel ??
                    null,

                  tipoTreino:
                    tipoTreino ??
                    null,

                  categoria:
                    Array.isArray(
                      categoria
                    )
                      ? (
                          categoria as Categoria[]
                        )
                      : [],

                  duracao:
                    duracao ??
                    null,

                  dicas:
                    Array.isArray(
                      dicas
                    )
                      ? dicas
                      : [],

                  conteudo,

                  publico:
                    Boolean(
                      publico
                    ),

                  parceiro:
                    Boolean(
                      parceiro
                    ),

                  naoExpira:
                    Boolean(
                      naoExpira
                    ),

                  expiraEm,

                  /*
                   * Nunca confiamos mais
                   * em criadoPorUsuarioId
                   * vindo do cliente.
                   */
                  criadoPorUsuarioId:
                    contexto.usuarioId,

                  ...owner,
                },
              });
          }
        );

      if (!created) {
        return res.status(400).json(
          (
            res as any
          ).__limitPayload ??
            {
              code:
                "LIMIT_TREINOS_SALVOS",

              message:
                `Você já possui ${MAX_SLOTS} treinos salvos. Escolha um para apagar.`,
            }
        );
      }

      return res
        .status(201)
        .json(
          created
        );
    } catch (err: any) {
      console.error(
        "criarTreinoSalvo",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao criar treino salvo",

        error:
          String(
            err?.message ??
            err
          ),
      });
    }
  };

export const listarTreinosSalvos =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        tipoUsuario,
        tipoUsuarioId,
        includePublic,
      } =
        req.query as any;

      const contexto =
        await resolverContextoTreinoSalvo(
          req,
          {
            tipoUsuario,
            tipoUsuarioId,
          }
        );

      if (!contexto) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O contexto ativo não pode acessar treinos salvos.",
        });
      }

      if (
        contexto.isAdmin &&
        !ownerValido(
          contexto.owner
        )
      ) {
        return res.status(400).json({
          message:
            "Informe o dono que deseja consultar.",
        });
      }

      const salvos =
        await prisma
          .treinoSalvo
          .findMany({
            where: {
              usuarioId:
                contexto.usuarioId,

              ...contexto.owner,

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

            orderBy: {
              createdAt:
                "desc",
            },

            select: {
              id:
                true,

              titulo:
                true,

              createdAt:
                true,

              atualizadoEm:
                true,

              expiraEm:
                true,

              treinoProgramadoId:
                true,
            },

            take:
              50,
          });

      const idsProgramados =
        Array.from(
          new Set(
            salvos
              .map((s) =>
                String(
                  s.treinoProgramadoId
                )
              )
              .filter(Boolean)
          )
        );

      const programados =
        idsProgramados.length
          ? await prisma
              .treinoProgramado
              .findMany({
                where: {
                  id: {
                    in:
                      idsProgramados,
                  },
                },

                select: {
                  id:
                    true,

                  nome:
                    true,

                  createdAt:
                    true,
                },
              })
          : [];

      const mapNome =
        new Map(
          programados.map(
            (p) => [
              p.id,
              p.nome,
            ]
          )
        );

      const validos =
        salvos.filter(
          (s) =>
            mapNome.has(
              String(
                s.treinoProgramadoId
              )
            )
        );

      const orfaos =
        salvos.filter(
          (s) =>
            !mapNome.has(
              String(
                s.treinoProgramadoId
              )
            )
        );

      if (
        orfaos.length
      ) {
        await prisma
          .treinoSalvo
          .deleteMany({
            where: {
              usuarioId:
                contexto.usuarioId,

              ...contexto.owner,

              id: {
                in:
                  orfaos.map(
                    (o) =>
                      o.id
                  ),
              },
            },
          });
      }

      const meus =
        validos.map(
          (s) => ({
            id:
              s.id,

            titulo:
              s.titulo,

            createdAt:
              s.createdAt,

            atualizadoEm:
              s.atualizadoEm,

            expiraEm:
              s.expiraEm,

            treinoProgramadoId:
              s.treinoProgramadoId,

            treinoProgramado: {
              nome:
                mapNome.get(
                  String(
                    s.treinoProgramadoId
                  )
                ) ??
                "(Removido)",
            },
          })
        );

      let publicos:
        any[] =
        [];

      if (
        String(
          includePublic
        ) === "1"
      ) {
        publicos =
          await prisma
            .treinoSalvo
            .findMany({
              where: {
                publico:
                  true,

                parceiro:
                  true,

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

              orderBy: {
                atualizadoEm:
                  "desc",
              },

              take:
                50,
            });
      }

      return res.json({
        meus,
        publicos,
      });
    } catch (err: any) {
      console.error(
        "listarTreinosSalvos",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao listar treinos salvos",

        error:
          String(
            err?.message ??
            err
          ),
      });
    }
  };

export const reutilizarTreinoSalvo =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        String(
          req.params.id ??
          ""
        ).trim();

      if (!id) {
        return res.status(400).json({
          message:
            "Treino salvo inválido.",
        });
      }

      const contexto =
        await resolverContextoTreinoSalvo(
          req
        );

      if (!contexto) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O contexto ativo não pode reutilizar treinos.",
        });
      }

      /*
       * TreinoSalvoReuso registra
       * especificamente um Professor.
       *
       * Por isso:
       *
       * Pedro — Professor
       * Clube X — Professor
       *
       * funcionam.
       *
       * Clube X — Proprietário
       * não inventa um professorId.
       */
      const professorId =
        contexto
          .professorAtivoId;

      if (!professorId) {
        return res.status(403).json({
          code:
            "PROFESSOR_CONTEXT_REQUIRED",

          message:
            "Use um contexto de Professor para reutilizar este treino.",
        });
      }

      const treino =
        await prisma
          .treinoSalvo
          .findUnique({
            where: {
              id,
            },
          });

      if (!treino) {
        return res.status(404).json({
          message:
            "Treino salvo não encontrado.",
        });
      }

      const publicoDisponivel =
        treino.publico ===
          true &&
        treino.parceiro ===
          true &&
        (
          treino.expiraEm ===
            null ||
          treino.expiraEm >
            new Date()
        );

      const proprio =
        treino.usuarioId ===
          contexto.usuarioId &&
        treinoPertenceAoOwner(
          treino,
          contexto.owner
        );

      if (
        !publicoDisponivel &&
        !proprio &&
        !contexto.isAdmin
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Este treino salvo não está disponível para o contexto ativo.",
        });
      }

      try {
        await prisma
          .treinoSalvoReuso
          .create({
            data: {
              treinoSalvoId:
                id,

              professorId,
            },
          });
      } catch {
        /*
         * Já reutilizado pelo mesmo
         * Professor.
         *
         * O @@unique do Prisma impede
         * duplicar a contagem.
         */
      }

      const totalProfessores =
        await prisma
          .treinoSalvoReuso
          .count({
            where: {
              treinoSalvoId:
                id,
            },
          });

      const updateData:
        any = {
          reutilizacoesProfessores:
            totalProfessores,
        };

      if (
        !treino.naoExpira
      ) {
        updateData.expiraEm =
          addDays(
            new Date(),
            TTL_DIAS
          );
      }

      const updated =
        await prisma
          .treinoSalvo
          .update({
            where: {
              id,
            },

            data:
              updateData,
          });

      return res.json(
        updated
      );
    } catch (err: any) {
      console.error(
        "reutilizarTreinoSalvo",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao marcar reutilização",

        error:
          String(
            err?.message ??
            err
          ),
      });
    }
  };

export const deletarTreinoSalvo =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        String(
          req.params.id ??
          ""
        ).trim();

      if (!id) {
        return res.status(400).json({
          message:
            "Treino salvo inválido.",
        });
      }

      const contexto =
        await resolverContextoTreinoSalvo(
          req
        );

      if (!contexto) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O contexto ativo não pode apagar treinos salvos.",
        });
      }

      const treino =
        await prisma
          .treinoSalvo
          .findUnique({
            where: {
              id,
            },

            select: {
              id:
                true,

              usuarioId:
                true,

              professorId:
                true,

              clubeId:
                true,

              escolinhaId:
                true,
            },
          });

      if (!treino) {
        return res.status(404).json({
          message:
            "Treino salvo não encontrado.",
        });
      }

      if (
        !contexto.isAdmin &&
        (
          treino.usuarioId !==
            contexto.usuarioId ||
          !treinoPertenceAoOwner(
            treino,
            contexto.owner
          )
        )
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Este treino salvo não pertence ao contexto ativo.",
        });
      }

      await prisma
        .treinoSalvo
        .delete({
          where: {
            id,
          },
        });

      return res.json({
        ok:
          true,
      });
    } catch (err: any) {
      console.error(
        "deletarTreinoSalvo",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao apagar treino salvo",

        error:
          String(
            err?.message ??
            err
          ),
      });
    }
  };

export const limparTreinosSalvosExpirados =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const usuarioId =
        String(
          (req as any).userId ??
          (req as any).user?.id ??
          ""
        ).trim();

      if (!usuarioId) {
        return res.status(401).json({
          message:
            "Não autenticado.",
        });
      }

      /*
       * Esse endpoint apaga registros
       * globalmente.
       *
       * Antes qualquer usuário
       * autenticado podia chamá-lo.
       */
      const isAdmin =
        await canPermission(
          usuarioId,
          "VER_ADMIN"
        );

      if (!isAdmin) {
        return res.status(403).json({
          code:
            "PERMISSION_DENIED",

          message:
            "Sem permissão para executar esta manutenção.",
        });
      }

      const del =
        await prisma
          .treinoSalvo
          .deleteMany({
            where: {
              expiraEm: {
                lte:
                  new Date(),
              },
            },
          });

      return res.json({
        removidos:
          del.count,
      });
    } catch (err: any) {
      console.error(
        "limparTreinosSalvosExpirados",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao limpar expirados",

        error:
          String(
            err?.message ??
            err
          ),
      });
    }
  };