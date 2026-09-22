import {
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  hasRole,
  papelCanonico,
} from "./roles.js";


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
  papelRecebido: TipoUsuario,
): readonly AppPermission[] {
  const papel =
    papelCanonico(
      papelRecebido,
    );

  switch (papel) {
    case TipoUsuario.Professor:
      return [
        "CRIAR_TREINO",
        "GERENCIAR_TURMA",
        "CRIAR_EVENTO",
        "PUBLICAR_METODOLOGIA",
      ];

    case TipoUsuario.Clube:
    case TipoUsuario.Escolinha:
      return [
        "CRIAR_TREINO",
        "GERENCIAR_TURMA",
        "GERENCIAR_ORGANIZACAO",
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

    case TipoUsuario.Federacao:
    case TipoUsuario.Marca:
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


export async function canPermission(
  usuarioId: string,
  permission: AppPermission,
): Promise<boolean> {
  if (!usuarioId) {
    return false;
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },

      select: {
        tipo: true,

        administrador: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!usuario) {
    return false;
  }

  const papelAtivo =
    papelCanonico(
      usuario.tipo,
    );

  const isAdmin =
    Boolean(
      usuario.administrador,
    ) ||
    papelAtivo ===
      TipoUsuario.Admin;

  if (isAdmin) {
    return true;
  }

  const possuiPapelAtivo =
    await hasRole(
      usuarioId,
      papelAtivo,
    );

  if (!possuiPapelAtivo) {
    return false;
  }

  return permissoesDoPapel(
    papelAtivo,
  ).includes(
    permission,
  );
}

export async function getPermissionSnapshot(
  usuarioId: string,
): Promise<
  Record<AppPermission, boolean>
> {
  const entries =
    await Promise.all(
      APP_PERMISSIONS.map(
        async (permission) =>
          [
            permission,
            await canPermission(
              usuarioId,
              permission,
            ),
          ] as const,
      ),
    );

  return Object.fromEntries(
    entries,
  ) as Record<
    AppPermission,
    boolean
  >;
}