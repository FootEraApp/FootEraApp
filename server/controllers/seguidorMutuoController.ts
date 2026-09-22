import {
  Request,
  Response,
} from "express";

import {
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

type PapelContato =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha"
  | "Olheiro"
  | "Marca"
  | "Federacao"
  | "Learning"
  | "Creator";

function normalizarPapelContato(
  valor: unknown
): PapelContato | null {
  const raw =
    String(valor ?? "")
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

  if (raw === "olheiro") {
    return "Olheiro";
  }

  if (raw === "marca") {
    return "Marca";
  }

  if (
    raw === "federacao" ||
    raw === "federação"
  ) {
    return "Federacao";
  }

  if (raw === "learning") {
    return "Learning";
  }

  if (raw === "creator") {
    return "Creator";
  }

  return null;
}

function normalizarPapeisContato(
  valor: unknown
): PapelContato[] {
  const partes =
    Array.isArray(valor)
      ? valor.flatMap((item) =>
          String(item ?? "").split(",")
        )
      : String(valor ?? "").split(",");

  return Array.from(
    new Set(
      partes
        .map((item) =>
          normalizarPapelContato(
            item
          )
        )
        .filter(
          (
            papel
          ): papel is PapelContato =>
            papel !== null
        )
    )
  );
}

function enumsDoPapel(
  papel: PapelContato
): TipoUsuario[] {
  if (papel === "Escolinha") {
    return [
      TipoUsuario.Escolinha,
      TipoUsuario.Escola,
    ];
  }

  return [
    papelParaEnum(
      papel
    ),
  ];
}

function papelParaEnum(
  papel: PapelContato
): TipoUsuario {
  switch (papel) {
    case "Atleta":
      return TipoUsuario.Atleta;

    case "Professor":
      return TipoUsuario.Professor;

    case "Clube":
      return TipoUsuario.Clube;

    case "Escolinha":
      return TipoUsuario.Escolinha;

    case "Olheiro":
      return TipoUsuario.Olheiro;

    case "Marca":
      return TipoUsuario.Marca;

    case "Federacao":
      return TipoUsuario.Federacao;

    case "Learning":
      return TipoUsuario.Learning;

    case "Creator":
      return TipoUsuario.Creator;
  }
}

function adicionarId(
  set: Set<string>,
  valor:
    | string
    | null
    | undefined
) {
  const id =
    String(
      valor ?? ""
    ).trim();

  if (id) {
    set.add(id);
  }
}

async function buscarRede(
  usuarioId: string
) {
  const [
    seguindo,
    seguidores,
  ] =
    await Promise.all([
      prisma.seguidor.findMany({
        where: {
          seguidorUsuarioId:
            usuarioId,
        },

        select: {
          seguidoUsuarioId:
            true,
        },
      }),

      prisma.seguidor.findMany({
        where: {
          seguidoUsuarioId:
            usuarioId,
        },

        select: {
          seguidorUsuarioId:
            true,
        },
      }),
    ]);

  const idsSeguindo =
    seguindo.map(
      (item) =>
        item.seguidoUsuarioId
    );

  const idsSeguidores =
    seguidores.map(
      (item) =>
        item.seguidorUsuarioId
    );

  const seguidoresSet =
    new Set(
      idsSeguidores
    );

  const mutuos =
    idsSeguindo.filter(
      (id) =>
        seguidoresSet.has(
          id
        )
    );

  return {
    mutuos,
  };
}

async function buscarVinculados(
  usuarioId: string
) {
  const ids =
    new Set<string>();

  const [
    atleta,
    professor,
    clube,
    escolinha,
    olheiro,
  ] =
    await Promise.all([
      prisma.atleta.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,

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
        },
      }),

      prisma.professor.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.clube.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.escolinha.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.olheiro.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,

          colaboracaoClube: {
            select: {
              usuarioId: true,
            },
          },

          colaboracaoEscolinha: {
            select: {
              usuarioId: true,
            },
          },
        },
      }),
    ]);

  if (atleta) {
    adicionarId(
      ids,
      atleta.clube
        ?.usuarioId
    );

    adicionarId(
      ids,
      atleta.escolinha
        ?.usuarioId
    );

    const relacoes =
      await prisma.relacaoTreinamento.findMany({
        where: {
          atletaId:
            atleta.id,

          ativo: true,
          encerradoEm:
            null,
        },

        select: {
          professor: {
            select: {
              usuarioId:
                true,
            },
          },

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
        },
      });

    for (
      const rel of
      relacoes
    ) {
      adicionarId(
        ids,
        rel.professor
          ?.usuarioId
      );

      adicionarId(
        ids,
        rel.clube
          ?.usuarioId
      );

      adicionarId(
        ids,
        rel.escolinha
          ?.usuarioId
      );
    }
  }

  if (olheiro) {
    adicionarId(
      ids,
      olheiro
        .colaboracaoClube
        ?.usuarioId
    );

    adicionarId(
      ids,
      olheiro
        .colaboracaoEscolinha
        ?.usuarioId
    );
  }

  if (professor) {
    const [
      relacoes,
      clubes,
      escolinhas,
      parceiros,
    ] =
      await Promise.all([
        prisma.relacaoTreinamento.findMany({
          where: {
            professorId:
              professor.id,

            ativo: true,
            encerradoEm:
              null,
          },

          select: {
            atleta: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.professorClube.findMany({
          where: {
            professorId:
              professor.id,
          },

          select: {
            clube: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.professorEscolinha.findMany({
          where: {
            professorId:
              professor.id,
          },

          select: {
            escolinha: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.professorParceiro.findMany({
          where: {
            OR: [
              {
                professorAId:
                  professor.id,
              },

              {
                professorBId:
                  professor.id,
              },
            ],
          },

          select: {
            professorA: {
              select: {
                usuarioId:
                  true,
              },
            },

            professorB: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),
      ]);

    for (
      const rel of
      relacoes
    ) {
      adicionarId(
        ids,
        rel.atleta
          ?.usuarioId
      );
    }

    for (
      const item of
      clubes
    ) {
      adicionarId(
        ids,
        item.clube
          ?.usuarioId
      );
    }

    for (
      const item of
      escolinhas
    ) {
      adicionarId(
        ids,
        item.escolinha
          ?.usuarioId
      );
    }

    for (
      const item of
      parceiros
    ) {
      adicionarId(
        ids,
        item.professorA
          ?.usuarioId
      );

      adicionarId(
        ids,
        item.professorB
          ?.usuarioId
      );
    }
  }

  if (clube) {
    const [
      atletas,
      professores,
      relacoes,
      olheiros,
    ] =
      await Promise.all([
        prisma.atleta.findMany({
          where: {
            clubeId:
              clube.id,
          },

          select: {
            usuarioId:
              true,
          },
        }),

        prisma.professorClube.findMany({
          where: {
            clubeId:
              clube.id,
          },

          select: {
            professor: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.relacaoTreinamento.findMany({
          where: {
            clubeId:
              clube.id,

            ativo: true,
            encerradoEm:
              null,
          },

          select: {
            atleta: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.olheiro.findMany({
          where: {
            colaboracaoClubeId:
              clube.id,
          },

          select: {
            usuarioId: true,
          },
        }),
      ]);

    for (
      const item of
      atletas
    ) {
      adicionarId(
        ids,
        item.usuarioId
      );
    }

    for (
      const item of
      professores
    ) {
      adicionarId(
        ids,
        item.professor
          ?.usuarioId
      );
    }

    for (
      const item of
      relacoes
    ) {
      adicionarId(
        ids,
        item.atleta
          ?.usuarioId
      );
    }

    for (
      const item of
      olheiros
    ) {
      adicionarId(
        ids,
        item.usuarioId
      );
    }
  }

  if (escolinha) {
    const [
      atletas,
      professores,
      relacoes,
      olheiros,
    ] =
      await Promise.all([
        prisma.atleta.findMany({
          where: {
            escolinhaId:
              escolinha.id,
          },

          select: {
            usuarioId:
              true,
          },
        }),

        prisma.professorEscolinha.findMany({
          where: {
            escolinhaId:
              escolinha.id,
          },

          select: {
            professor: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.relacaoTreinamento.findMany({
          where: {
            escolinhaId:
              escolinha.id,

            ativo: true,
            encerradoEm:
              null,
          },

          select: {
            atleta: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        }),

        prisma.olheiro.findMany({
          where: {
            colaboracaoEscolinhaId:
              escolinha.id,
          },

          select: {
            usuarioId: true,
          },
        }),
      ]);

    for (
      const item of
      atletas
    ) {
      adicionarId(
        ids,
        item.usuarioId
      );
    }

    for (
      const item of
      professores
    ) {
      adicionarId(
        ids,
        item.professor
          ?.usuarioId
      );
    }

    for (
      const item of
      relacoes
    ) {
      adicionarId(
        ids,
        item.atleta
          ?.usuarioId
      );
    }

    for (
      const item of
      olheiros
    ) {
      adicionarId(
        ids,
        item.usuarioId
      );
    }
  }

  ids.delete(
    usuarioId
  );

  return Array.from(
    ids
  );
}

export const buscarSeguidoresMutuos =
  async (
    req: Request,
    res: Response
  ) => {
    const usuarioId =
      String(
        req.userId || ""
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        mensagem:
          "Usuário não autenticado.",
      });
    }

    try {
      const modo =
        String(
          req.query.modo ||
            ""
        )
          .trim()
          .toLowerCase();

      const papeis =
        normalizarPapeisContato(
          req.query.papeis ??
            req.query.papel
        );

      const {
        mutuos,
      } =
        await buscarRede(
          usuarioId
        );

      if (
        modo !== "convite"
      ) {
        const usuariosMutuos =
          await prisma.usuario.findMany({
            where: {
              id: {
                in:
                  mutuos,
              },
            },

            select: {
              id: true,
              nome: true,
              foto: true,
              tipo: true,
            },

            orderBy: {
              nome: "asc",
            },
          });

        return res.json(
          usuariosMutuos
        );
      }

      const vinculados =
        await buscarVinculados(
          usuarioId
        );

      const ids =
        Array.from(
          new Set([
            ...mutuos,
            ...vinculados,
          ])
        ).filter(
          (id) =>
            id !== usuarioId
        );

      const whereUsuario: any = {
        id: {
          in: ids,
        },
      };

      if (papeis.length > 0) {
        const papeisEnum =
          Array.from(
            new Set<TipoUsuario>(
              papeis.flatMap(
                (papel) =>
                  enumsDoPapel(
                    papel
                  )
              )
            )
          );

        whereUsuario.OR = [
          {
            tipo: {
              in:
                papeisEnum,
            },
          },

          {
            papeis: {
              some: {
                papel: {
                  in:
                    papeisEnum,
                },

                status:
                  StatusUsuarioPapel.ATIVO,
              },
            },
          },
        ];
      }

      const usuarios =
        await prisma.usuario.findMany({
          where:
            whereUsuario,

          select: {
            id: true,
            nome: true,
            foto: true,
            tipo: true,

            papeis: {
              where: {
                status:
                  StatusUsuarioPapel.ATIVO,
              },

              select: {
                papel:
                  true,
              },
            },
          },

          orderBy: {
            nome: "asc",
          },
        });

      return res.json(
        usuarios.map(
          (usuario) => {
            const papeis =
              Array.from(
                new Set([
                  String(
                    usuario.tipo
                  ),

                  ...usuario.papeis.map(
                    (item) =>
                      String(
                        item.papel
                      )
                  ),
                ])
              );

            return {
              id:
                usuario.id,

              nome:
                usuario.nome,

              foto:
                usuario.foto,

              tipo:
                usuario.tipo,

              papeis,
            };
          }
        )
      );
    } catch (erro) {
      console.error(
        "Erro ao buscar contatos:",
        erro
      );

      return res
        .status(500)
        .json({
          mensagem:
            "Erro interno do servidor.",
        });
    }
  };