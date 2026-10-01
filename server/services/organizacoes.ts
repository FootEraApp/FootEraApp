import {
  FuncaoMembroOrganizacao,
  Prisma,
  TipoOrganizacao,
  TipoUsuario,
  StatusUsuarioPapel,
} from "@prisma/client";
import { getActiveContext } from "./activeContext.js";
import {
  prisma,
} from "../prisma.js";

export type TipoOrganizacaoLegada =
  | "CLUBE"
  | "ESCOLINHA"
  | "MARCA"
  | "FEDERACAO";

const prioridadeFuncao:
  Record<
    FuncaoMembroOrganizacao,
    number
  > = {
    MEMBRO: 1,
    PROFESSOR: 2,
    ADMINISTRADOR: 3,
    PROPRIETARIO: 4,
  };

function tipoOrganizacaoNova(
  tipo:
    TipoOrganizacaoLegada
): TipoOrganizacao {
  switch (tipo) {
    case "CLUBE":
      return TipoOrganizacao.CLUBE;

    case "ESCOLINHA":
      return TipoOrganizacao.ESCOLA;

    case "MARCA":
      return TipoOrganizacao.MARCA;

    case "FEDERACAO":
      return TipoOrganizacao.FEDERACAO;
  }
}

async function buscarLegado(
  db: any,
  tipo:
    TipoOrganizacaoLegada,
  ownerId: string,
) {
  switch (tipo) {
    case "CLUBE":
      return db.clube.findUnique({
        where: {
          id: ownerId,
        },

        select: {
          id: true,
          nome: true,
          usuarioId: true,
          organizacaoId: true,
        },
      });

    case "ESCOLINHA":
      return db.escolinha.findUnique({
        where: {
          id: ownerId,
        },

        select: {
          id: true,
          nome: true,
          usuarioId: true,
          organizacaoId: true,
        },
      });

    case "MARCA":
      return db.marca.findUnique({
        where: {
          id: ownerId,
        },

        select: {
          id: true,
          nome: true,
          usuarioId: true,
          organizacaoId: true,
        },
      });

    case "FEDERACAO":
      return db.federacao.findUnique({
        where: {
          id: ownerId,
        },

        select: {
          id: true,
          nome: true,
          usuarioId: true,
          organizacaoId: true,
        },
      });
  }
}

async function atualizarLegadoOrganizacaoId(
  db: any,
  tipo:
    TipoOrganizacaoLegada,
  ownerId: string,
  organizacaoId: string,
) {
  const data = {
    organizacaoId,
  };

  switch (tipo) {
    case "CLUBE":
      return db.clube.update({
        where: {
          id: ownerId,
        },
        data,
      });

    case "ESCOLINHA":
      return db.escolinha.update({
        where: {
          id: ownerId,
        },
        data,
      });

    case "MARCA":
      return db.marca.update({
        where: {
          id: ownerId,
        },
        data,
      });

    case "FEDERACAO":
      return db.federacao.update({
        where: {
          id: ownerId,
        },
        data,
      });
  }
}

async function salvarMembro(
  db: any,
  params: {
    organizacaoId: string;
    usuarioId: string;

    funcao:
      FuncaoMembroOrganizacao;

    permissoes?: any;

    ativo?: boolean;

    preservarMaiorFuncao?: boolean;
  }
) {
  const {
    organizacaoId,
    usuarioId,
    funcao,
    permissoes,
    ativo = true,
    preservarMaiorFuncao = true,
  } = params;

  const existente = (
    await db.membroOrganizacao.findUnique({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId,
          usuarioId,
        },
      },

      select: {
        id: true,
        funcao: true,
      },
    })
  ) as
    | {
        id: string;
        funcao: FuncaoMembroOrganizacao;
      }
    | null;

  let funcaoFinal =
    funcao;

  if (
    existente?.funcao ===
    FuncaoMembroOrganizacao.PROPRIETARIO
  ) {
    funcaoFinal =
      FuncaoMembroOrganizacao.PROPRIETARIO;
  } else if (
    existente &&
    preservarMaiorFuncao &&
    prioridadeFuncao[
      existente.funcao
    ] >
      prioridadeFuncao[
        funcao
      ]
  ) {
    funcaoFinal =
      existente.funcao;
  }

  return db.membroOrganizacao.upsert({
    where: {
      organizacaoId_usuarioId: {
        organizacaoId,
        usuarioId,
      },
    },

    update: {
      funcao:
        funcaoFinal,

      ativo,

      ...(permissoes !==
      undefined
        ? {
            permissoes,
          }
        : {}),
    },

    create: {
      organizacaoId,
      usuarioId,

      funcao:
        funcaoFinal,

      ativo,

      permissoes:
        permissoes ??
        null,
    },
  });
}

export async function sincronizarProfessorProprio(
  params: {
    usuarioId: string;
    tx?: Prisma.TransactionClient;
  }
) {
  const db: any =
    params.tx ??
    prisma;

  const usuarioId =
    String(
      params.usuarioId || ""
    ).trim();

  if (!usuarioId) {
    return;
  }

  const papelProfessor =
    await db.usuarioPapel.findFirst({
      where: {
        usuarioId,

        papel:
          TipoUsuario.Professor,

        status:
          StatusUsuarioPapel.ATIVO,
      },

      select: {
        id: true,
      },
    });

  // Usuário migrado:
  // só cria vínculo se Professor estiver ATIVO.
  if (!papelProfessor) {
    return;
  }

  const professor =
    await db.professor.findUnique({
      where: {
        usuarioId,
      },

      select: {
        id: true,
      },
    });

  if (!professor) {
    return;
  }

  const [
    clubes,
    escolinhas,
  ] = await Promise.all([
    db.clube.findMany({
      where: {
        usuarioId,
      },

      select: {
        id: true,
      },
    }),

    db.escolinha.findMany({
      where: {
        usuarioId,
      },

      select: {
        id: true,
      },
    }),
  ]);

  for (
    const clube of clubes
  ) {
    await db.professorClube.upsert({
      where: {
        professorId_clubeId: {
          professorId:
            professor.id,

          clubeId:
            clube.id,
        },
      },

      update: {
        papel:
          "Professor",
      },

      create: {
        professorId:
          professor.id,

        clubeId:
          clube.id,

        papel:
          "Professor",
      },
    });
  }

  for (
    const escolinha of
      escolinhas
  ) {
    await db.professorEscolinha.upsert({
      where: {
        professorId_escolinhaId: {
          professorId:
            professor.id,

          escolinhaId:
            escolinha.id,
        },
      },

      update: {
        papel:
          "Professor",
      },

      create: {
        professorId:
          professor.id,

        escolinhaId:
          escolinha.id,

        papel:
          "Professor",
      },
    });
  }
}

export async function garantirOrganizacaoLegada(
  params: {
    tipo:
      TipoOrganizacaoLegada;
    ownerId: string;
    proprietarioUsuarioId?:
      string | null;
    tx?:
      Prisma.TransactionClient;
  }
) {
  const db: any =
    params.tx ??
    prisma;

  const legado =
    await buscarLegado(
      db,
      params.tipo,
      params.ownerId,
    );

  if (!legado) {
    throw new Error(
      "Organização legada não encontrada."
    );
  }

  const legacyKey =
    `${params.tipo}:${params.ownerId}`;

  const organizacao =
    await db.organizacao.upsert({
      where: {
        legacyKey,
      },

      update: {
        nome:
          legado.nome,

        tipo:
          tipoOrganizacaoNova(
            params.tipo
          ),

        ativo: true,
      },

      create: {
        legacyKey,

        nome:
          legado.nome,

        tipo:
          tipoOrganizacaoNova(
            params.tipo
          ),

        ativo: true,
      },
    });

  if (
    legado.organizacaoId !==
    organizacao.id
  ) {
    await atualizarLegadoOrganizacaoId(
      db,
      params.tipo,
      params.ownerId,
      organizacao.id,
    );
  }

  const proprietarioUsuarioId =
    params.proprietarioUsuarioId ??
    legado.usuarioId ??
    null;

  if (
    proprietarioUsuarioId
  ) {
    await salvarMembro(
      db,
      {
        organizacaoId:
          organizacao.id,

        usuarioId:
          proprietarioUsuarioId,

        funcao:
          FuncaoMembroOrganizacao.PROPRIETARIO,

        ativo:
          true,
      }
    );
  }

  if (
    proprietarioUsuarioId
  ) {
    await sincronizarProfessorProprio({
      usuarioId:
        proprietarioUsuarioId,

      tx:
        params.tx,
    });
  }

  return organizacao;
}

export async function sincronizarMembroOrganizacaoLegada(
  params: {
    tipo:
      TipoOrganizacaoLegada;

    ownerId: string;

    usuarioId: string;

    funcao:
      FuncaoMembroOrganizacao;

    permissoes?: any;

    ativo?: boolean;

    preservarMaiorFuncao?:
      boolean;

    tx?:
      Prisma.TransactionClient;
  }
) {
  const db: any =
    params.tx ??
    prisma;

  const organizacao =
    await garantirOrganizacaoLegada({
      tipo:
        params.tipo,

      ownerId:
        params.ownerId,

      tx:
        params.tx,
    });

  return salvarMembro(
    db,
    {
      organizacaoId:
        organizacao.id,

      usuarioId:
        params.usuarioId,

      funcao:
        params.funcao,

      permissoes:
        params.permissoes,

      ativo:
        params.ativo ??
        true,

      preservarMaiorFuncao:
        params.preservarMaiorFuncao,
    }
  );
}

export async function obterOrganizacaoIdPorLegado(
  params: {
    tipo: TipoOrganizacaoLegada;
    ownerId: string;
    tx?: Prisma.TransactionClient;
  }
): Promise<string | null> {
  const db: any =
    params.tx ??
    prisma;

  const legado =
    await buscarLegado(
      db,
      params.tipo,
      params.ownerId,
    );

  if (!legado) {
    return null;
  }

  if (
    legado.organizacaoId
  ) {
    return String(
      legado.organizacaoId
    );
  }

  const organizacao =
    await garantirOrganizacaoLegada({
      tipo:
        params.tipo,

      ownerId:
        params.ownerId,

      tx:
        params.tx,
    });

  return organizacao.id;
}

export async function obterOrganizacaoAtivaDoUsuario(
  usuarioId: string,
): Promise<string | null> {
  const contexto =
    await getActiveContext(
      usuarioId
    );

  if (
    contexto?.kind !==
    "ORGANIZATION"
  ) {
    return null;
  }

  return (
    contexto.organizationId ??
    null
  );
}