import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";
import {
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

function normalizaTipo(
  raw: string
): TipoUsuario | null {
  const t =
    String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  const map:
    Record<
      string,
      TipoUsuario
    > = {
    atleta:
      TipoUsuario.Atleta,

    learning:
      TipoUsuario.Learning,

    escola:
      TipoUsuario.Escolinha,

    escolinha:
      TipoUsuario.Escolinha,

    clube:
      TipoUsuario.Clube,

    marca:
      TipoUsuario.Marca,

    federacao:
      TipoUsuario.Federacao,

    professor:
      TipoUsuario.Professor,

    admin:
      TipoUsuario.Admin,

    administrador:
      TipoUsuario.Admin,

    olheiro:
      TipoUsuario.Olheiro,

    scout:
      TipoUsuario.Olheiro,

    creator:
      TipoUsuario.Creator,
  };

  return map[t] ?? null;
}

function papelCanonicoAdmin(
  papel: TipoUsuario
): TipoUsuario {
  return papel ===
    TipoUsuario.Escola
    ? TipoUsuario.Escolinha
    : papel;
}

function papeisDoUsuarioAdmin(
  tipoLegado: TipoUsuario,
  registros: Array<{
    papel: TipoUsuario;
    status: StatusUsuarioPapel;
  }>,
  possuiAdministrador: boolean
): TipoUsuario[] {
  const ativos =
    registros
      .filter(
        (registro) =>
          registro.status ===
          StatusUsuarioPapel.ATIVO
      )
      .map(
        (registro) =>
          papelCanonicoAdmin(
            registro.papel
          )
      )
      .filter(
        (papel) =>
          papel !== TipoUsuario.Admin
      );

  const papeis =
    registros.length > 0
      ? ativos
      : (
          tipoLegado ===
          TipoUsuario.Admin
            ? []
            : [
                papelCanonicoAdmin(
                  tipoLegado
                ),
              ]
        );

  if (possuiAdministrador) {
    papeis.push(
      TipoUsuario.Admin
    );
  }

  return Array.from(
    new Set(papeis)
  );
}

function resolveFoto(u: any): string | null {
  return (
    u.foto ??
    u.atleta?.foto ??
    u.professor?.fotoUrl ??
    u.clube?.logo ??
    u.escolinha?.logo ??
    u.marca?.logo ??
    u.federacao?.logo ??
    u.olheiro?.fotoUrl ??
    null
  );
}

export async function listAdminUsers(
  req: Request,
  res: Response
) {
  try {
    const page =
      Math.max(
        1,
        Number(
          req.query.page || 1
        ) || 1
      );

    const pageSize =
      Math.min(
        100,
        Math.max(
          1,
          Number(
            req.query.pageSize ||
              20
          ) || 20
        )
      );

    const q =
      String(
        req.query.q || ""
      ).trim();

    const tipo =
      normalizaTipo(
        String(
          req.query.tipo || ""
        )
      );

    const destaqueParam =
      String(
        req.query.destaque ||
          ""
      )
        .trim()
        .toLowerCase();

    const ordenarPor =
      String(
        req.query.ordenarPor ||
          "nome"
      )
        .trim()
        .toLowerCase();

    const ordem:
      | "asc"
      | "desc" =
      String(
        req.query.ordem ||
          "asc"
      ).toLowerCase() ===
      "desc"
        ? "desc"
        : "asc";

    const where: any = {};

    if (q) {
      where.OR = [
        {
          nome: {
            contains: q,
            mode:
              "insensitive",
          },
        },

        {
          nomeDeUsuario: {
            contains: q,
            mode:
              "insensitive",
          },
        },

        {
          email: {
            contains: q,
            mode:
              "insensitive",
          },
        },
      ];
    }

    /*
     * Filtro por papel.
     *
     * Não usamos mais
     * where.tipo = tipo.
     */
    if (tipo) {
      let idsPermitidos:
        string[] = [];

      /*
       * Admin global é definido
       * pela relação Administrador.
       */
      if (
        tipo ===
        TipoUsuario.Admin
      ) {
        const admins =
          await prisma.administrador.findMany({
            select: {
              usuarioId:
                true,
            },
          });

        idsPermitidos =
          admins.map(
            (admin) =>
              admin.usuarioId
          );
      } else {
        const papeisEquivalentes:
          TipoUsuario[] =
          tipo ===
          TipoUsuario.Escolinha
            ? [
                TipoUsuario.Escolinha,
                TipoUsuario.Escola,
              ]
            : [tipo];

        /*
         * Usuários que já possuem
         * qualquer UsuarioPapel.
         *
         * Para eles, Usuario.tipo
         * não pode ser usado como
         * fallback.
         */
        const usuariosComPapel =
          await prisma.usuarioPapel.findMany({
            select: {
              usuarioId:
                true,
            },

            distinct: [
              "usuarioId",
            ],
          });

        const idsComPapel =
          usuariosComPapel.map(
            (registro) =>
              registro.usuarioId
          );

        /*
         * Papel explícito ativo.
         */
        const papeisAtivos =
          await prisma.usuarioPapel.findMany({
            where: {
              papel: {
                in:
                  papeisEquivalentes,
              },

              status:
                StatusUsuarioPapel.ATIVO,
            },

            select: {
              usuarioId:
                true,
            },
          });

        /*
         * Compatibilidade com contas
         * antigas que ainda não têm
         * nenhuma linha em
         * UsuarioPapel.
         */
        const legados =
          await prisma.usuario.findMany({
            where: {
              tipo: {
                in:
                  papeisEquivalentes,
              },

              ...(idsComPapel.length >
              0
                ? {
                    id: {
                      notIn:
                        idsComPapel,
                    },
                  }
                : {}),
            },

            select: {
              id:
                true,
            },
          });

        idsPermitidos =
          Array.from(
            new Set([
              ...papeisAtivos.map(
                (registro) =>
                  registro.usuarioId
              ),

              ...legados.map(
                (usuario) =>
                  usuario.id
              ),
            ])
          );
      }

      /*
       * Sem correspondências:
       * força resultado vazio.
       */
      where.id = {
        in:
          idsPermitidos,
      };
    }

    if (
      destaqueParam ===
      "true"
    ) {
      where.destaque =
        true;
    }

    if (
      destaqueParam ===
      "false"
    ) {
      where.destaque =
        false;
    }

    let orderBy:
      any[];

    if (
      ordenarPor ===
      "criadoem"
    ) {
      orderBy = [
        {
          dataCriacao:
            ordem,
        },

        {
          id:
            "asc",
        },
      ];
    } else {
      orderBy = [
        {
          nome:
            ordem,
        },

        {
          nomeDeUsuario:
            ordem,
        },

        {
          email:
            ordem,
        },

        {
          id:
            "asc",
        },
      ];
    }

    const [rows, total] =
      await prisma.$transaction([
        prisma.usuario.findMany({
          where,

          skip:
            (page - 1) *
            pageSize,

          take:
            pageSize,

          orderBy,

          include: {
            atleta: {
              select: {
                foto:
                  true,
              },
            },

            professor: {
              select: {
                fotoUrl:
                  true,
              },
            },

            clube: {
              select: {
                logo:
                  true,
              },
            },

            escolinha: {
              select: {
                logo:
                  true,
              },
            },

            marca: {
              select: {
                logo:
                  true,
              },
            },

            federacao: {
              select: {
                logo:
                  true,
              },
            },

            olheiro: {
              select: {
                fotoUrl:
                  true,
              },
            },
          },
        }),

        prisma.usuario.count({
          where,
        }),
      ]);

    const usuarioIds =
      rows.map(
        (usuario) =>
          usuario.id
      );

    /*
     * Buscamos UsuarioPapel
     * separadamente para não
     * depender do nome da relação
     * inversa no model Usuario.
     */
    const registrosPapel =
      usuarioIds.length > 0
        ? await prisma.usuarioPapel.findMany({
            where: {
              usuarioId: {
                in:
                  usuarioIds,
              },
            },

            select: {
              usuarioId:
                true,

              papel:
                true,

              status:
                true,
            },

            orderBy: {
              criadoEm:
                "asc",
            },
          })
        : [];

    const administradores =
      usuarioIds.length > 0
        ? await prisma.administrador.findMany({
            where: {
              usuarioId: {
                in:
                  usuarioIds,
              },
            },

            select: {
              usuarioId:
                true,
            },
          })
        : [];

    const adminIds =
      new Set(
        administradores.map(
          (admin) =>
            admin.usuarioId
        )
      );

    const papeisPorUsuario =
      new Map<
        string,
        Array<{
          papel:
            TipoUsuario;

          status:
            StatusUsuarioPapel;
        }>
      >();

    for (
      const registro of
      registrosPapel
    ) {
      const lista =
        papeisPorUsuario.get(
          registro.usuarioId
        ) ?? [];

      lista.push({
        papel:
          registro.papel,

        status:
          registro.status,
      });

      papeisPorUsuario.set(
        registro.usuarioId,
        lista
      );
    }

    const items =
      rows.map((u) => {
        const rawCriado =
          (u as any)
            .criadoEm ??
          (u as any)
            .dataCriacao ??
          (u as any)
            .createdAt ??
          null;

        const criadoEm =
          rawCriado &&
          typeof (
            rawCriado as any
          ).toISOString ===
            "function"
            ? (
                rawCriado as any
              ).toISOString()
            : rawCriado;

        const papeis =
          papeisDoUsuarioAdmin(
            u.tipo,
            papeisPorUsuario.get(
              u.id
            ) ?? [],
            adminIds.has(
              u.id
            )
          );

        return {
          id:
            u.id,

          nome:
            u.nome,

          nomeDeUsuario:
            u.nomeDeUsuario,

          email:
            u.email ??
            null,

          /*
           * Mantido temporariamente
           * para compatibilidade com
           * o frontend antigo.
           */
          tipo:
            u.tipo,

          /*
           * Nova fonte para o admin.
           */
          papeis,

          foto:
            resolveFoto(u),

          criadoEm,

          verificado:
            (u as any)
              .verified ??
            false,

          destaque:
            (u as any)
              .destaque ??
            false,

          status:
            (u as any)
              .status ??
            "ATIVO",

          blockedAt:
            (u as any)
              .blockedAt ??
            null,

          blockedReason:
            (u as any)
              .blockedReason ??
            null,

          deletedAt:
            (u as any)
              .deletedAt ??
            null,

          ultimaAtividade:
            null as
              | string
              | null,

          ultimaAtividadeNome:
            null as
              | string
              | null,
        };
      });

    return res.json({
      items,
      total,
      page,
      pageSize,
    });
  } catch (e: any) {
    return sendError(
      res,
      e,
      "Erro ao listar usuários (admin)."
    );
  }
}

export async function getAdminUserDetail(req: Request, res: Response) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    include: {
      atleta: { select: { id: true, foto: true, posicao: true } },
      professor: { select: { id: true, fotoUrl: true } },
      clube: { select: { id: true, logo: true } },
      escolinha: { select: { id: true, logo: true } },
      marca: { select: { id: true, logo: true } },
      federacao: { select: { id: true, logo: true } },
      olheiro: { select: { id: true, fotoUrl: true } },
      learningProfile: { select: { id: true } },
      _count: {
        select: { postagens: true, comentarios: true, seguidores: true },
      },
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado" });

  const registrosPapel =
    await prisma.usuarioPapel.findMany({
      where: {
        usuarioId:
          u.id,
      },

      select: {
        papel:
          true,

        status:
          true,
      },

      orderBy: {
        criadoEm:
          "asc",
      },
    });

  const administrador =
    await prisma.administrador.findUnique({
      where: {
        usuarioId:
          u.id,
      },

      select: {
        usuarioId:
          true,
      },
    });

  const papeis =
    papeisDoUsuarioAdmin(
      u.tipo,
      registrosPapel,
      Boolean(
        administrador
      )
    );

  const temAtleta =
    papeis.includes(
      TipoUsuario.Atleta
    );

  const [
    ultima,
    posicaoCampo,
    totalVinculados,
  ] = await Promise.all([
    temAtleta
      ? ultimaAtividadeDeAtleta(
          u.id
        )
      : Promise.resolve(
          null
        ),

    temAtleta
      ? posicaoDoAtletaPorUsuarioId(
          u.id
        )
      : Promise.resolve(
          null
        ),

    totalVinculadosDoUsuario(
      u.id,
      papeis,
    ),
  ]);

  res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email ?? null,
    tipo: u.tipo,
    papeis,
    foto: resolveFoto(u),
    criadoEm:
      (u as any).criadoEm ??
      (u as any).dataCriacao ??
      (u as any).createdAt ??
      null,
    verificado: (u as any).verified ?? false,
    destaque: (u as any).destaque ?? false,
    contagens: {
      posts: u._count.postagens,
      comentarios: u._count.comentarios,
      seguidores: u._count.seguidores,
    },
    posicaoCampo,
    totalVinculados,
    ultimaAtividade: ultima?.when?.toISOString() ?? null,
    ultimaAtividadeNome: ultima?.label ?? null,
    status: (u as any).status ?? "ATIVO",
    blockedAt: (u as any).blockedAt ?? null,
    blockedReason: (u as any).blockedReason ?? null,
    deletedAt: (u as any).deletedAt ?? null,
  });
}

async function ultimaAtividadeDeAtleta(usuarioId: string) {
  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!atleta) return null;

  const ultimaSub = await prisma.submissaoDesafio.findFirst({
    where: { atletaId: atleta.id },
    include: { desafio: { select: { titulo: true } } },
    orderBy: { createdAt: "desc" },
  });

  const ultimaTreino = await prisma.submissaoTreino.findFirst({
    where: { atletaId: atleta.id },
    include: {
      treinoAgendado: {
        include: { treinoProgramado: { select: { nome: true } } },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  const candidatos: { when: Date; label: string }[] = [];
  if (ultimaSub) {
    candidatos.push({
      when: ultimaSub.createdAt,
      label: `Desafio: ${ultimaSub.desafio?.titulo ?? "Desafio"}`,
    });
  }
  if (ultimaTreino) {
    const when = (ultimaTreino.atualizadoEm ?? ultimaTreino.criadoEm) as Date;
    const nomeTreino =
      ultimaTreino.treinoTituloSnapshot ||
      ultimaTreino.treinoAgendado?.titulo ||
      ultimaTreino.treinoAgendado?.treinoProgramado?.nome ||
      "Treino";
    candidatos.push({ when, label: `Treino: ${nomeTreino}` });
  }

  if (!candidatos.length) return null;
  candidatos.sort((a, b) => +b.when - +a.when);
  return candidatos[0];
}

function legivelPosicao(cod?: string | null): string | null {
  if (!cod) return null;
  const key = cod.toUpperCase();
  const map: Record<string, string> = {
    GOL: "Goleiro",
    LD: "Lateral Direito",
    ZD: "Zagueiro Direito",
    ZE: "Zagueiro Esquerdo",
    LE: "Lateral Esquerdo",
    VOL1: "Volante",
    VOL2: "Volante",
    MEI: "Meia",
    PD: "Ponta Direita",
    CA: "Centroavante",
    PE: "Ponta Esquerda",
  };
  return map[key] ?? cod;
}

async function posicaoDoAtletaPorUsuarioId(usuarioId: string) {
  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true, posicao: true },
  });
  if (!atleta) return null;
  if (atleta.posicao) return legivelPosicao(atleta.posicao);
  const ultNoElenco = await prisma.atletaElenco.findFirst({
    where: { atletaId: atleta.id },
    orderBy: { updatedAt: "desc" },
    select: { posicao: true },
  });
  return ultNoElenco ? legivelPosicao(ultNoElenco.posicao) : null;
}

async function totalVinculadosDoUsuario(
  usuarioId: string,
  papeis: TipoUsuario[]
) {
  let total =
    0;

  if (
    papeis.includes(
      TipoUsuario.Professor
    )
  ) {
    const prof =
      await prisma.professor.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id:
            true,
        },
      });

    if (prof) {
      total +=
        await prisma.relacaoTreinamento.count({
          where: {
            professorId:
              prof.id,

            atletaId: {
              not:
                null,
            },
          },
        });
    }
  }

  if (
    papeis.includes(
      TipoUsuario.Clube
    )
  ) {
    const clube =
      await prisma.clube.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id:
            true,
        },
      });

    if (clube) {
      total +=
        await prisma.atleta.count({
          where: {
            clubeId:
              clube.id,
          },
        });
    }
  }

  if (
    papeis.includes(
      TipoUsuario.Escolinha
    ) ||
    papeis.includes(
      TipoUsuario.Escola
    )
  ) {
    const esc =
      await prisma.escolinha.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id:
            true,
        },
      });

    if (esc) {
      total +=
        await prisma.atleta.count({
          where: {
            escolinhaId:
              esc.id,
          },
        });
    }
  }

  return total;
}

export async function patchAdminUser(req: Request, res: Response) {
  const { id } = req.params;
  const { verificado, destaque } = req.body as {
    verificado?: boolean;
    destaque?: boolean;
  };

  const data: any = {};

  if (typeof verificado === "boolean") {
    data.verified = verificado;
  }

  if (typeof destaque === "boolean") {
    data.destaque = destaque;
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({
      message: "Nenhum campo válido para atualizar.",
    });
  }

  const u = await prisma.usuario.update({
    where: { id },
    data,
    select: {
      id: true,
      nome: true,
      nomeDeUsuario: true,
      email: true,
      tipo: true,
      foto: true,
      dataCriacao: true,
      verified: true,
      destaque: true,
      status: true,
      blockedAt: true,
      blockedReason: true,
      deletedAt: true,
    },
  });

  return res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email ?? null,
    tipo: u.tipo,
    foto: u.foto ?? null,
    criadoEm: u.dataCriacao,
    verificado: u.verified,
    destaque: u.destaque,
    status: u.status,
    blockedAt: u.blockedAt,
    blockedReason: u.blockedReason,
    deletedAt: u.deletedAt,
  });
}

export async function banUser(_req: Request, res: Response) {
  res.status(501).json({ message: "Banimento não implementado." });
}

export async function unbanUser(_req: Request, res: Response) {
  res.status(501).json({ message: "Desbanir não implementado." });
}

export async function removeUserContent(req: Request, res: Response) {
  const { id } = req.params;
  const { escopo } = req.body as {
    escopo: "posts" | "comentarios" | "todos";
  };
  if (escopo === "posts" || escopo === "todos")
    await prisma.postagem.deleteMany({ where: { usuarioId: id } });
  if (escopo === "comentarios" || escopo === "todos")
    await prisma.comentario.deleteMany({ where: { usuarioId: id } });
  res.json({ ok: true });
}

export async function hardDeleteUsuario(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const requesterId =
      String(
        (req as any).userId ??
          (req as any).user?.id ??
          (req as any).authUser?.id ??
          ""
      ).trim();
    if (requesterId && requesterId === id) {
      return res.status(400).json({ message: "Você não pode excluir sua própria conta." });
    }

    const exists =
      await prisma.usuario.findUnique({
        where: {
          id,
        },

        select: {
          id:
            true,

          email:
            true,

          administrador: {
            select: {
              usuarioId:
                true,

              cargo:
                true,

              nivel:
                true,
            },
          },
        },
      });
    if (!exists) return res.status(404).json({ message: "Usuário não encontrado." });

    if (exists.administrador) {
      const cargo =
        String(
          exists.administrador
            .cargo ??
            ""
        )
          .trim()
          .toLowerCase()
          .replace(
            /\s+/g,
            " "
          );

      const nivel =
        String(
          exists.administrador
            .nivel ??
            ""
        )
          .trim()
          .toLowerCase();

      const isByCargo =
        cargo === "owner" ||
        cargo === "superadmin" ||
        cargo === "super admin";

      const isByNivel =
        nivel ===
        "performance";

      const isByEnv =
        Boolean(
          process.env
            .SUPERADMIN_EMAIL
        ) &&
        exists.email
          ?.toLowerCase() ===
          process.env
            .SUPERADMIN_EMAIL!
            .toLowerCase();

      if (
        isByCargo ||
        isByNivel ||
        isByEnv
      ) {
        return res.status(403).json({
          message:
            "Não é permitido excluir permanentemente o super admin.",
        });
      }

      const totalAdmins =
        await prisma.administrador.count();

      if (
        totalAdmins <= 1
      ) {
        return res.status(400).json({
          message:
            "Não é possível excluir o último administrador.",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitacaoTreino.deleteMany({
        where: { OR: [{ remetenteId: id }, { destinatarioId: id }] },
      });

      if ((tx as any).amigo) {
        await (tx as any).amigo.deleteMany({
          where: { OR: [{ usuarioId: id }, { amigoId: id }] },
        });
      }

      if ((tx as any).notificacao) {
        await (tx as any).notificacao.deleteMany({
          where: { OR: [{ usuarioId: id }, { actorId: id }] },
        });
      }

      if ((tx as any).comentario) await (tx as any).comentario.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).curtida) await (tx as any).curtida.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).compartilhamento) await (tx as any).compartilhamento.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).postagem) await (tx as any).postagem.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).favoritoUsuario) await (tx as any).favoritoUsuario.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).atleta) await (tx as any).atleta.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).professor) await (tx as any).professor.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).clube) await (tx as any).clube.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).escolinha) await (tx as any).escolinha.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).olheiro) await (tx as any).olheiro.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).administrador) await (tx as any).administrador.deleteMany({ where: { usuarioId: id } });

      await tx.usuarioPapel.deleteMany({
        where: {
          usuarioId:
            id,
        },
      });

      await tx.usuario.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return sendError(
      res,
      e,
      "Falha ao excluir permanentemente. Veja o log do servidor para a tabela que bloqueou (FK)."
    );
  }
}