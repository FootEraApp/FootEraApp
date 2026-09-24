import {
  FuncaoMembroOrganizacao,
  StatusUsuarioPapel,
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";
import {
  prisma,
} from "../prisma.js";
import {
  getProfileIdForRole,
  hasRole,
  normalizarPapel,
  papelCanonico,
} from "./roles.js";

export type ActiveContextKind =
  | "PERSONAL"
  | "ORGANIZATION";

export type ActiveContext = {
  key: string;
  kind:
    ActiveContextKind;
  label: string;
  tipoUsuario:
    TipoUsuario;
  tipoUsuarioId:
    string | null;
  role?:
    TipoUsuario | null;
  profileId?:
    string | null;
  organizationId?:
    string | null;
  organizationType?:
    TipoOrganizacao | null;
  organizationRole?:
    FuncaoMembroOrganizacao | null;
  legacyOrganizationId?:
    string | null;
  organizationPermissions?:
    unknown;
};

export class ActiveContextError
  extends Error {
  status: number;
  code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);

    this.status =
      status;

    this.code =
      code;
  }
}

function ehPapelOrganizacao(
  papel:
    TipoUsuario,
) {
  const canonico =
    papelCanonico(
      papel,
    );

  return (
    canonico ===
      TipoUsuario.Clube ||
    canonico ===
      TipoUsuario.Escolinha ||
    canonico ===
      TipoUsuario.Marca ||
    canonico ===
      TipoUsuario.Federacao
  );
}

function ehPapelPessoalSelecionavel(
  papel: TipoUsuario,
) {
  const canonico =
    papelCanonico(papel);

  return (
    canonico === TipoUsuario.Atleta ||
    canonico === TipoUsuario.Professor ||
    canonico === TipoUsuario.Olheiro ||
    canonico === TipoUsuario.Creator ||
    canonico === TipoUsuario.Admin
  );
}

function tipoOrganizacaoDoPapel(
  papel:
    TipoUsuario,
): TipoOrganizacao | null {
  const canonico =
    papelCanonico(
      papel,
    );

  switch (canonico) {
    case TipoUsuario.Clube:
      return TipoOrganizacao.CLUBE;

    case TipoUsuario.Escolinha:
      return TipoOrganizacao.ESCOLA;

    case TipoUsuario.Marca:
      return TipoOrganizacao.MARCA;

    case TipoUsuario.Federacao:
      return TipoOrganizacao.FEDERACAO;

    default:
      return null;
  }
}

function papelDaOrganizacao(
  tipo:
    TipoOrganizacao,
): TipoUsuario {
  switch (tipo) {
    case TipoOrganizacao.CLUBE:
      return TipoUsuario.Clube;

    case TipoOrganizacao.ESCOLA:
      return TipoUsuario.Escolinha;

    case TipoOrganizacao.MARCA:
      return TipoUsuario.Marca;

    case TipoOrganizacao.FEDERACAO:
      return TipoUsuario.Federacao;
  }
}

function labelPapel(
  papel:
    TipoUsuario,
) {
  switch (
    papelCanonico(
      papel
    )
  ) {
    case TipoUsuario.Atleta:
      return "Atleta";

    case TipoUsuario.Professor:
      return "Professor";

    case TipoUsuario.Olheiro:
      return "Olheiro";

    case TipoUsuario.Creator:
      return "Creator";

    case TipoUsuario.Learning:
      return "Learning";

    case TipoUsuario.Admin:
      return "Administrador";

    default:
      return String(
        papel
      );
  }
}

function labelFuncao(
  funcao:
    FuncaoMembroOrganizacao,
) {
  switch (funcao) {
    case FuncaoMembroOrganizacao.PROPRIETARIO:
      return "Proprietário";

    case FuncaoMembroOrganizacao.ADMINISTRADOR:
      return "Administrador";

    case FuncaoMembroOrganizacao.PROFESSOR:
      return "Professor";

    case FuncaoMembroOrganizacao.MEMBRO:
      return "Membro";
  }
}

function legacyIdOrganizacao(
  organizacao:
    any,
): string | null {
  return (
    organizacao?.clube?.id ??
    organizacao?.escolinha?.id ??
    organizacao?.marca?.id ??
    organizacao?.federacao?.id ??
    null
  );
}

const includeOrganizacao = {
  organizacao: {
    select: {
      id: true,
      nome: true,
      tipo: true,
      ativo: true,

      clube: {
        select: {
          id: true,
        },
      },

      escolinha: {
        select: {
          id: true,
        },
      },

      marca: {
        select: {
          id: true,
        },
      },

      federacao: {
        select: {
          id: true,
        },
      },
    },
  },
} as const;

async function montarContextoPessoal(
  usuario: {
    id: string;
    nome: string;
  },

  papel:
    TipoUsuario,
): Promise<
  ActiveContext
> {
  const canonico =
    papelCanonico(
      papel
    );

  const profileId =
    await getProfileIdForRole(
      usuario.id,
      canonico,
    );

  return {
    key:
      `personal:${canonico}`,

    kind:
      "PERSONAL",

    label:
      `${usuario.nome} — ${labelPapel(
        canonico
      )}`,

    tipoUsuario:
      canonico,

    tipoUsuarioId:
      profileId,

    role:
      canonico,

    profileId,
  };
}

async function compatibilidadeOrganizacao(
  usuario: {
    id: string;
    tipo: TipoUsuario;
  },

  membro:
    any,
): Promise<{
  tipoUsuario:
    TipoUsuario;

  tipoUsuarioId:
    string | null;
}> {
  if (
    membro.funcao ===
    FuncaoMembroOrganizacao.PROFESSOR
  ) {
    return {
      tipoUsuario:
        TipoUsuario.Professor,

      tipoUsuarioId:
        await getProfileIdForRole(
          usuario.id,
          TipoUsuario.Professor,
        ),
    };
  }

  if (
    membro.funcao ===
    FuncaoMembroOrganizacao.MEMBRO
  ) {
    const atletaId =
      await getProfileIdForRole(
        usuario.id,
        TipoUsuario.Atleta,
      );

    return {
      tipoUsuario:
        TipoUsuario.Atleta,

      tipoUsuarioId:
        atletaId,
    };
  }

  return {
    tipoUsuario:
      papelDaOrganizacao(
        membro.organizacao.tipo
      ),

    tipoUsuarioId:
      legacyIdOrganizacao(
        membro.organizacao
      ),
  };
}

async function montarContextoOrganizacao(
  usuario: {
    id: string;
    tipo: TipoUsuario;
  },

  membro:
    any,
): Promise<
  ActiveContext
> {
  const compat =
    await compatibilidadeOrganizacao(
      usuario,
      membro,
    );

  return {
    key:
      `organization:${membro.organizacao.id}`,

    kind:
      "ORGANIZATION",

    label:
      `${membro.organizacao.nome} — ${labelFuncao(
        membro.funcao
      )}`,

    tipoUsuario:
      compat.tipoUsuario,

    tipoUsuarioId:
      compat.tipoUsuarioId,

    organizationId:
      membro.organizacao.id,

    organizationType:
      membro.organizacao.tipo,

    organizationRole:
      membro.funcao,

    legacyOrganizationId:
      legacyIdOrganizacao(
        membro.organizacao
      ),

    organizationPermissions:
      membro.permissoes ??
      null,
  };
}

export async function listarActiveContexts(
  usuarioId:
    string,
): Promise<
  ActiveContext[]
> {
  const [
    usuario,
    papeis,
    membros,
  ] =
    await Promise.all([
      prisma.usuario.findUnique({
        where: {
          id:
            usuarioId,
        },

        select: {
          id: true,
          nome: true,
          tipo: true,

          administrador: {
            select: {
              id: true,
            },
          },
        },
      }),

      prisma.usuarioPapel.findMany({
        where: {
          usuarioId,

          status:
            StatusUsuarioPapel.ATIVO,
        },

        select: {
          papel: true,
        },

        orderBy: {
          criadoEm:
            "asc",
        },
      }),

      prisma.membroOrganizacao.findMany({
        where: {
          usuarioId,

          ativo:
            true,

          organizacao: {
            is: {
              ativo:
                true,
            },
          },
        },

        include:
          includeOrganizacao,

        orderBy: {
          createdAt:
            "asc",
        },
      }),
    ]);

  if (!usuario) {
    return [];
  }

  const papeisPessoais =
    new Set<TipoUsuario>();

  for (
    const item of papeis
  ) {
    const papel =
      papelCanonico(
        item.papel
      );

    if (
    ehPapelPessoalSelecionavel(
        papel
    )
    ) {
    papeisPessoais.add(
        papel
    );
    }
  }

  const papelAtual =
    papelCanonico(
      usuario.tipo
    );

  if (
    ehPapelPessoalSelecionavel(
        papelAtual
    )
  ) {
    papeisPessoais.add(
        papelAtual
    );
  }

  if (
    usuario.administrador
  ) {
    papeisPessoais.add(
      TipoUsuario.Admin
    );
  }

  const contextosPessoais:
    ActiveContext[] =
    [];

  for (
    const papel of
      papeisPessoais
  ) {
    const contexto =
      await montarContextoPessoal(
        usuario,
        papel,
      );

    if (
      contexto.tipoUsuarioId
    ) {
      contextosPessoais.push(
        contexto
      );
    }
  }

  const contextosOrganizacao =
    await Promise.all(
      membros.map(
        (membro) =>
          montarContextoOrganizacao(
            usuario,
            membro,
          )
      )
    );

  return [
    ...contextosPessoais,
    ...contextosOrganizacao,
  ];
}

export async function getActiveContext(
  usuarioId:
    string,
): Promise<
  ActiveContext | null
> {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },

      select: {
        id: true,
        nome: true,
        tipo: true,
        contextoOrganizacaoId:
          true,
      },
    });

  if (!usuario) {
    return null;
  }

  if (
    usuario.contextoOrganizacaoId
  ) {
    const membro =
      await prisma.membroOrganizacao.findUnique({
        where: {
          organizacaoId_usuarioId: {
            organizacaoId:
              usuario.contextoOrganizacaoId,

            usuarioId,
          },
        },

        include:
          includeOrganizacao,
      });

    if (
      membro?.ativo &&
      membro.organizacao
        ?.ativo
    ) {
      return montarContextoOrganizacao(
        usuario,
        membro,
      );
    }
  }

  const tipoOrg =
    tipoOrganizacaoDoPapel(
      usuario.tipo
    );

  if (tipoOrg) {
    const membros =
      await prisma.membroOrganizacao.findMany({
        where: {
          usuarioId,

          ativo:
            true,

          organizacao: {
            is: {
              ativo:
                true,

              tipo:
                tipoOrg,
            },
          },
        },

        include:
          includeOrganizacao,

        orderBy: {
          createdAt:
            "asc",
        },
      });

    const escolhido =
      membros.find(
        (m) =>
          m.funcao ===
          FuncaoMembroOrganizacao.PROPRIETARIO
      ) ??
      membros[0];

    if (escolhido) {
      return montarContextoOrganizacao(
        usuario,
        escolhido,
      );
    }
  }

  return montarContextoPessoal(
    usuario,
    usuario.tipo,
  );
}

export async function definirActiveContext(
  usuarioId:
    string,

  contextKey:
    string,
): Promise<
  ActiveContext
> {
  const key =
    String(
      contextKey || ""
    ).trim();

  if (
    key.startsWith(
      "personal:"
    )
  ) {
    const raw =
      key.slice(
        "personal:".length
      );

    const papelRecebido =
      normalizarPapel(
        raw
      );

    if (
      !papelRecebido
    ) {
      throw new ActiveContextError(
        400,
        "INVALID_CONTEXT",
        "Contexto pessoal inválido.",
      );
    }

    const papel =
      papelCanonico(
        papelRecebido
      );

    if (
      ehPapelOrganizacao(
        papel
      )
    ) {
      throw new ActiveContextError(
        400,
        "USE_ORGANIZATION_CONTEXT",
        "Use a organização correspondente.",
      );
    }

    const usuario =
      await prisma.usuario.findUnique({
        where: {
          id:
            usuarioId,
        },

        select: {
          id: true,
          nome: true,

          administrador: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!usuario) {
      throw new ActiveContextError(
        404,
        "USER_NOT_FOUND",
        "Usuário não encontrado.",
      );
    }

    if (
      papel ===
      TipoUsuario.Admin
    ) {
      if (
        !usuario.administrador
      ) {
        throw new ActiveContextError(
          403,
          "CONTEXT_NOT_ALLOWED",
          "Você não possui este contexto.",
        );
      }
    } else {
      const possui =
        await hasRole(
          usuarioId,
          papel,
        );

      if (!possui) {
        throw new ActiveContextError(
          403,
          "CONTEXT_NOT_ALLOWED",
          "Você não possui este contexto.",
        );
      }
    }

    const profileId =
      await getProfileIdForRole(
        usuarioId,
        papel,
      );

    if (!profileId) {
      throw new ActiveContextError(
        409,
        "CONTEXT_PROFILE_MISSING",
        "O perfil deste contexto ainda não foi concluído.",
      );
    }

    await prisma.usuario.update({
      where: {
        id:
          usuarioId,
      },

      data: {
        tipo:
          papel,

        contextoOrganizacaoId:
          null,
      },
    });

    return montarContextoPessoal(
      usuario,
      papel,
    );
  }

  if (
    key.startsWith(
      "organization:"
    )
  ) {
    const organizacaoId =
      key.slice(
        "organization:".length
      ).trim();

    if (!organizacaoId) {
      throw new ActiveContextError(
        400,
        "INVALID_CONTEXT",
        "Organização inválida.",
      );
    }

    const membro =
      await prisma.membroOrganizacao.findUnique({
        where: {
          organizacaoId_usuarioId: {
            organizacaoId,
            usuarioId,
          },
        },

        include:
          includeOrganizacao,
      });

    if (
      !membro ||
      !membro.ativo ||
      !membro.organizacao
        ?.ativo
    ) {
      throw new ActiveContextError(
        403,
        "CONTEXT_NOT_ALLOWED",
        "Você não participa desta organização.",
      );
    }

    await prisma.usuario.update({
      where: {
        id:
          usuarioId,
      },

      data: {
        contextoOrganizacaoId:
          organizacaoId,
      },
    });

    const usuario =
      await prisma.usuario.findUniqueOrThrow({
        where: {
          id:
            usuarioId,
        },

        select: {
          id: true,
          tipo: true,
        },
      });

    return montarContextoOrganizacao(
      usuario,
      membro,
    );
  }

  throw new ActiveContextError(
    400,
    "INVALID_CONTEXT",
    "Contexto inválido.",
  );
}