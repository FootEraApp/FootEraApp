import {
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

import { prisma } from "../prisma.js";

export const PAPEIS_PESSOAIS = [
  TipoUsuario.Atleta,
  TipoUsuario.Professor,
  TipoUsuario.Olheiro,
  TipoUsuario.Creator,
] as const;

export const PAPEIS_ORGANIZACAO = [
  TipoUsuario.Clube,
  TipoUsuario.Escolinha,
  TipoUsuario.Escola,
  TipoUsuario.Marca,
  TipoUsuario.Federacao,
] as const;

export const PAPEIS_LEGADOS_CAPABILITY = [
  TipoUsuario.Learning,
] as const;

export function papelCanonico(
  papel: TipoUsuario,
): TipoUsuario {
  return papel === TipoUsuario.Escola
    ? TipoUsuario.Escolinha
    : papel;
}


export function normalizarPapel(
  valor: unknown,
): TipoUsuario | null {
  const raw = String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  switch (raw) {
    case "atleta":
      return TipoUsuario.Atleta;

    case "professor":
    case "profissional":
      return TipoUsuario.Professor;

    case "olheiro":
    case "scout":
      return TipoUsuario.Olheiro;

    case "creator":
      return TipoUsuario.Creator;

    case "clube":
      return TipoUsuario.Clube;

    case "escola":
    case "escolinha":
      return TipoUsuario.Escolinha;

    case "marca":
      return TipoUsuario.Marca;

    case "federacao":
      return TipoUsuario.Federacao;

    case "learning":
      return TipoUsuario.Learning;

    case "admin":
      return TipoUsuario.Admin;

    default:
      return null;
  }
}

export async function hasRole(
  usuarioId: string,
  papelRecebido: TipoUsuario,
  statuses: StatusUsuarioPapel[] = [
    StatusUsuarioPapel.ATIVO,
  ],
): Promise<boolean> {
  const papel =
    papelCanonico(papelRecebido);

  const papeisConsulta =
    papel === TipoUsuario.Escolinha
      ? [
          TipoUsuario.Escolinha,
          TipoUsuario.Escola,
        ]
      : [papel];

  const registro =
    await prisma.usuarioPapel.findFirst({
      where: {
        usuarioId,
        papel: {
          in: papeisConsulta,
        },
        status: {
          in: statuses,
        },
      },
      select: {
        id: true,
      },
    });

  if (registro) {
    return true;
  }

  if (
    !statuses.includes(
      StatusUsuarioPapel.ATIVO,
    )
  ) {
    return false;
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        tipo: true,
      },
    });

  if (!usuario) {
    return false;
  }

  return (
    papelCanonico(usuario.tipo) ===
    papel
  );
}

export async function getActiveRole(
  usuarioId: string,
): Promise<TipoUsuario | null> {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        tipo: true,
      },
    });

  if (!usuario) {
    return null;
  }

  return papelCanonico(
    usuario.tipo,
  );
}


export async function hasActiveRole(
  usuarioId: string,
  papelRecebido: TipoUsuario,
): Promise<boolean> {
  const papelAtivo =
    await getActiveRole(
      usuarioId,
    );

  if (!papelAtivo) {
    return false;
  }

  const papel =
    papelCanonico(
      papelRecebido,
    );

  if (papelAtivo !== papel) {
    return false;
  }

  return hasRole(
    usuarioId,
    papel,
  );
}

export async function getProfileIdForRole(
  usuarioId: string,
  papelRecebido: TipoUsuario,
): Promise<string | null> {
  const papel =
    papelCanonico(papelRecebido);

  switch (papel) {
    case TipoUsuario.Atleta:
      return (
        await prisma.atleta.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Professor:
      return (
        await prisma.professor.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Clube:
      return (
        await prisma.clube.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Escolinha:
      return (
        await prisma.escolinha.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Olheiro:
      return (
        await prisma.olheiro.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Learning:
      return (
        await prisma.learningProfile.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Federacao:
      return (
        await prisma.federacao.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Marca:
      return (
        await prisma.marca.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Creator:
      return (
        await prisma.creator.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    case TipoUsuario.Admin:
      return (
        await prisma.administrador.findUnique({
          where: {
            usuarioId,
          },
          select: {
            id: true,
          },
        })
      )?.id ?? null;

    default:
      return null;
  }
}