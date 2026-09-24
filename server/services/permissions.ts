import {
  FuncaoMembroOrganizacao,
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  hasRole,
  papelCanonico,
} from "./roles.js";

import {
  getActiveContext,
} from "./activeContext.js";


export type AppPermission =
  | "CRIAR_TREINO"
  | "GERENCIAR_TURMA"
  | "GERENCIAR_ORGANIZACAO"
  | "CRIAR_EVENTO"
  | "PUBLICAR_METODOLOGIA"
  | "VER_ADMIN";


export const APP_PERMISSIONS:
  AppPermission[] = [
    "CRIAR_TREINO",
    "GERENCIAR_TURMA",
    "GERENCIAR_ORGANIZACAO",
    "CRIAR_EVENTO",
    "PUBLICAR_METODOLOGIA",
    "VER_ADMIN",
  ];


function permissoesDoPapel(
  papelRecebido:
    TipoUsuario,
): readonly AppPermission[] {
  const papel =
    papelCanonico(
      papelRecebido
    );

  switch (papel) {
    case TipoUsuario.Professor:
      return [
        "CRIAR_TREINO",
        "GERENCIAR_TURMA",
        "CRIAR_EVENTO",
        "PUBLICAR_METODOLOGIA",
      ];

    case TipoUsuario.Olheiro:
      return [
        "CRIAR_EVENTO",
      ];

    case TipoUsuario.Creator:
      return [
        "CRIAR_EVENTO",
        "PUBLICAR_METODOLOGIA",
      ];

    case TipoUsuario.Admin:
      return APP_PERMISSIONS;

    case TipoUsuario.Atleta:
    case TipoUsuario.Learning:
    default:
      return [];
  }
}


function permissoesOrganizacao(
  tipo:
    TipoOrganizacao,

  funcao:
    FuncaoMembroOrganizacao,
): readonly AppPermission[] {
  if (
    funcao ===
      FuncaoMembroOrganizacao.MEMBRO
  ) {
    return [];
  }

  const clubeOuEscola =
    tipo ===
      TipoOrganizacao.CLUBE ||
    tipo ===
      TipoOrganizacao.ESCOLA;

  if (
    funcao ===
      FuncaoMembroOrganizacao.PROFESSOR
  ) {
    return clubeOuEscola
      ? [
          "CRIAR_TREINO",
          "GERENCIAR_TURMA",
          "CRIAR_EVENTO",
          "PUBLICAR_METODOLOGIA",
        ]
      : [
          "CRIAR_EVENTO",
          "PUBLICAR_METODOLOGIA",
        ];
  }

  /*
   * Proprietário e Administrador.
   */
  return clubeOuEscola
    ? [
        "CRIAR_TREINO",
        "GERENCIAR_TURMA",
        "GERENCIAR_ORGANIZACAO",
        "CRIAR_EVENTO",
        "PUBLICAR_METODOLOGIA",
      ]
    : [
        "GERENCIAR_ORGANIZACAO",
        "CRIAR_EVENTO",
        "PUBLICAR_METODOLOGIA",
      ];
}


async function permissoesAtivas(
  usuarioId:
    string,
): Promise<
  readonly AppPermission[]
> {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },

      select: {
        administrador: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!usuario) {
    return [];
  }

  /*
   * Admin global FootEra continua sendo
   * admin global independentemente do
   * contexto selecionado.
   */
  if (
    usuario.administrador
  ) {
    return APP_PERMISSIONS;
  }

  const contexto =
    await getActiveContext(
      usuarioId
    );

  if (!contexto) {
    return [];
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    if (
      !contexto.organizationType ||
      !contexto.organizationRole
    ) {
      return [];
    }

    return permissoesOrganizacao(
      contexto.organizationType,
      contexto.organizationRole,
    );
  }

  const papel =
    contexto.role ??
    contexto.tipoUsuario;

  const possuiPapel =
    await hasRole(
      usuarioId,
      papel,
    );

  if (!possuiPapel) {
    return [];
  }

  return permissoesDoPapel(
    papel
  );
}


export async function canPermission(
  usuarioId: string,
  permission:
    AppPermission,
): Promise<boolean> {
  if (!usuarioId) {
    return false;
  }

  const permissoes =
    await permissoesAtivas(
      usuarioId
    );

  return permissoes.includes(
    permission
  );
}


export async function getPermissionSnapshot(
  usuarioId:
    string,
): Promise<
  Record<
    AppPermission,
    boolean
  >
> {
  const ativas =
    await permissoesAtivas(
      usuarioId
    );

  const set =
    new Set(
      ativas
    );

  return Object.fromEntries(
    APP_PERMISSIONS.map(
      (permission) => [
        permission,
        set.has(permission),
      ]
    )
  ) as Record<
    AppPermission,
    boolean
  >;
}