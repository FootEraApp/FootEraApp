import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";
import {
  FuncaoMembroOrganizacao,
  StatusResponsavelAtleta,
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";
import { audit } from "../services/audit.js";
import {
  desativarPapeisPeloAdmin,
  ExclusaoPapelError,
} from "../services/exclusaoContaService.js";
import {
  diagnosticarExclusaoConta,
} from "../services/diagnosticoExclusaoConta.js";

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

    responsavel:
      TipoUsuario.Responsavel,
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
      papeis
    ),
  ]);

  res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email ?? null,
    tipo: u.tipo,
    dataNascimento: u.dataNascimento ?? null,
    cidade: u.cidade ?? null,
    estado: u.estado ?? null,
    pais: u.pais ?? null,
    cep: u.cep ?? null,
    logradouro: u.logradouro ?? null,
    responsavelTelefone: u.responsavelTelefone ?? null,
    papeisDetalhados: registrosPapel.map((registro) => ({
      papel: registro.papel,
      status: registro.status,
    })),
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
    await prisma.postagem.deleteMany({
      where: {
        usuarioId: id,
        organizacaoId: null,
      },
    });
  if (escopo === "comentarios" || escopo === "todos")
    await prisma.comentario.deleteMany({ where: { usuarioId: id } });
  res.json({ ok: true });
}

export async function hardDeleteUsuario(
  req: Request,
  res: Response
) {
  try {
    const usuarioId = String(req.params.id ?? "").trim();
    const confirmacao = String(req.body?.confirm ?? "").trim();
    const motivo = String(req.body?.motivo ?? "").trim();

    if (!usuarioId) {
      return res.status(400).json({
        message: "ID do usuário é obrigatório.",
      });
    }

    if (confirmacao !== "Excluir Conta Footera") {
      return res.status(400).json({
        message: 'Digite exatamente "Excluir Conta Footera".',
      });
    }

    if (motivo.length < 10) {
      return res.status(400).json({
        message: "Informe um motivo de pelo menos 10 caracteres.",
      });
    }

    if (req.userId === usuarioId) {
      return res.status(403).json({
        message: "Você não pode excluir sua própria conta pelo Admin.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        deletedAt: true,
        dataNascimento: true,
        atleta: {
          select: {
            idade: true,
            responsaveis: {
              where: {
                status: StatusResponsavelAtleta.ATIVO,
              },
              select: { id: true },
              take: 1,
            },
          },
        },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
        marca: { select: { id: true } },
        federacao: { select: { id: true } },
      },
    });

    if (!usuario) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    if (usuario.deletedAt) {
      return res.status(409).json({
        code: "ACCOUNT_ALREADY_SCHEDULED",
        message: "Esta conta já está na lixeira.",
      });
    }

    const [administrador, organizacoesProprietario] =
      await Promise.all([
        prisma.administrador.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
        prisma.membroOrganizacao.findMany({
          where: {
            usuarioId,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
          },
          select: {
            organizacaoId: true,
            organizacao: {
              select: {
                id: true,
                nome: true,
                tipo: true,
                ativo: true,
              },
            },
          },
        }),
      ]);

    if (administrador) {
      return res.status(409).json({
        code: "ADMIN_ACCOUNT_PROTECTED",
        message:
          "Esta conta possui acesso administrativo. Utilize o procedimento específico de remoção de administradores.",
      });
    }

    const organizacoesPendentes = organizacoesProprietario.map(
      (membro) => ({
        organizacaoId: membro.organizacaoId,
        nome: membro.organizacao.nome,
        tipo: membro.organizacao.tipo,
        motivo: "PROPRIETARIO",
        ativo: membro.organizacao.ativo,
        orientacao:
          "Transfira a propriedade ou solicite o encerramento institucional.",
      }),
    );

    const vinculosLegados = [
      usuario.clube && {
        tipo: "CLUBE",
        legadoId: usuario.clube.id,
      },
      usuario.escolinha && {
        tipo: "ESCOLA",
        legadoId: usuario.escolinha.id,
      },
      usuario.marca && {
        tipo: "MARCA",
        legadoId: usuario.marca.id,
      },
      usuario.federacao && {
        tipo: "FEDERACAO",
        legadoId: usuario.federacao.id,
      },
    ].filter(
      (item): item is {
        tipo: string;
        legadoId: string;
      } => Boolean(item)
    );

    const possuiVinculosLegados = Boolean(
      usuario.clube ||
      usuario.escolinha ||
      usuario.marca ||
      usuario.federacao
    );

    if (
      organizacoesPendentes.length > 0 ||
      possuiVinculosLegados
    ) {
      return res.status(409).json({
        code: "ORGANIZATION_OWNER",
        message:
          "Existem responsabilidades institucionais pendentes antes da exclusão.",
        details: {
          organizacoes: organizacoesPendentes,
          vinculosLegados,
          possuiVinculosLegados,
          orientacao:
            "Resolva todas as propriedades institucionais antes de solicitar a exclusão.",
        },
      });
    }

    let idade: number | null = null;

    if (usuario.dataNascimento) {
      const nascimento = usuario.dataNascimento;
      const hoje = new Date();

      idade = hoje.getFullYear() - nascimento.getFullYear();

      const aindaNaoFezAniversario =
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() &&
          hoje.getDate() < nascimento.getDate());

      if (aindaNaoFezAniversario) idade--;
    } else {
      idade = usuario.atleta?.idade ?? null;
    }

    if (
      idade !== null &&
      idade < 12 &&
      (usuario.atleta?.responsaveis.length ?? 0) > 0
    ) {
      return res.status(409).json({
        code: "SUPERVISED_ATHLETE",
        message:
          "Esta conta pertence a um atleta menor supervisionado. Utilize o fluxo específico de autorização.",
      });
    }

    const agora = new Date();
    const prazo = new Date(
      agora.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    const resultado = await prisma.usuario.updateMany({
      where: {
        id: usuarioId,
        deletedAt: null,
      },
      data: {
        deletedAt: agora,
        deleteScheduledAt: prazo,
        lastLogoutAt: agora,
        tokenVersion: { increment: 1 },
      },
    });

    if (resultado.count !== 1) {
      return res.status(409).json({
        message:
          "O estado da conta foi alterado. Atualize a página.",
      });
    }

    try {
      await audit(req, {
        acao: "CONTA_MOVIDA_PARA_LIXEIRA_ADMIN",
        entidade: "Usuario",
        entidadeId: usuarioId,
        descricao:
          "Administrador solicitou exclusão programada de conta.",
        meta: {
          motivo,
          deleteScheduledAt: prazo.toISOString(),
        },
      });
    } catch (erroAuditoria) {
      console.error(
        "[admin] Falha ao registrar auditoria de exclusão:",
        erroAuditoria
      );
    }

    return res.status(200).json({
      ok: true,
      message:
        "Conta enviada para a lixeira por 30 dias. Nenhum registro foi excluído fisicamente.",
      deleteScheduledAt: prazo.toISOString(),
    });
  } catch (error) {
    console.error(
      "[admin] Erro ao solicitar exclusão:",
      error
    );

    return res.status(500).json({
      message:
        "Não foi possível solicitar a exclusão da conta.",
    });
  }
}

export async function excluirPapeisUsuarioAdmin(
  req: Request,
  res: Response,
) {
  const usuarioId = String(req.params.id ?? "").trim();
  const papeis = req.body?.papeis;

  const confirmacao = String(
    req.body?.confirm ?? ""
  ).trim();

  if (confirmacao !== "Desativar Papéis FootEra") {
    return res.status(400).json({
      code: "CONFIRMATION_REQUIRED",
      message:
        'Digite exatamente "Desativar Papéis FootEra" para confirmar.',
    });
  }

  if (
    !usuarioId ||
    !Array.isArray(papeis) ||
    !papeis.every((papel) => typeof papel === "string")
  ) {
    return res.status(400).json({
      code: "INVALID_REQUEST",
      message: "Informe o usuário e uma lista válida de papéis.",
    });
  }

  if (req.userId === usuarioId) {
    return res.status(403).json({
      code: "ADMIN_SELF_CHANGE_DENIED",
      message:
        "Não remova seus próprios papéis por esta operação administrativa.",
    });
  }

  try {
    const resultado = await desativarPapeisPeloAdmin(
      usuarioId,
      papeis,
    );

    try {
      await audit(req, {
        acao: "PAPEIS_DESATIVADOS_ADMIN",
        entidade: "Usuario",
        entidadeId: usuarioId,
        descricao:
          "Superadministrador desativou papéis de um usuário.",
        meta: {
          papeisRemovidos: resultado.papeisRemovidos,
        },
      });
    } catch (auditError) {
      console.error(
        "[admin] Falha ao registrar auditoria:",
        auditError,
      );
    }

    return res.json(resultado);
  } catch (error) {
    if (error instanceof ExclusaoPapelError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    console.error(
      "[admin] Erro ao excluir papéis:",
      error,
    );

    return res.status(500).json({
      code: "ROLE_DELETION_FAILED",
      message:
        "Não foi possível concluir a exclusão dos papéis.",
    });
  }
}