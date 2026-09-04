import {
  Prisma,
  VisibilidadePostagem,
} from "@prisma/client";

import { prisma } from "../prisma.js";

export function normalizarVisibilidadePostagem(
  value: unknown,
  fallback: VisibilidadePostagem =
    VisibilidadePostagem.LOGADO
): VisibilidadePostagem {
  const raw =
    String(value || "")
      .trim()
      .toUpperCase();

  switch (raw) {
    case "PUBLICO":
      return VisibilidadePostagem.PUBLICO;

    case "LOGADO":
      return VisibilidadePostagem.LOGADO;

    case "SEGUIDORES":
      return VisibilidadePostagem.SEGUIDORES;

    case "PRIVADO":
      return VisibilidadePostagem.PRIVADO;

    default:
      return fallback;
  }
}

export async function getPostVisibilityWhere(
  viewerUsuarioId?: string | null
): Promise<Prisma.PostagemWhereInput> {
  if (!viewerUsuarioId) {
    return {
      oculto: false,

      visibilidade:
        VisibilidadePostagem.PUBLICO,
    };
  }

  const seguindo =
    await prisma.seguidor.findMany({
      where: {
        seguidorUsuarioId:
          viewerUsuarioId,
      },

      select: {
        seguidoUsuarioId: true,
      },
    });

  const seguindoIds =
    seguindo.map(
      (item) =>
        item.seguidoUsuarioId
    );

  const permitido:
    Prisma.PostagemWhereInput[] = [
      {
        visibilidade:
          VisibilidadePostagem.PUBLICO,
      },
      {
        visibilidade:
          VisibilidadePostagem.LOGADO,
      },
      {
        usuarioId:
          viewerUsuarioId,
      },
    ];

  if (seguindoIds.length > 0) {
    permitido.push({
      visibilidade:
        VisibilidadePostagem.SEGUIDORES,

      usuarioId: {
        in: seguindoIds,
      },
    });
  }

  return {
    oculto: false,

    OR: permitido,
  };
}

export async function podeVisualizarPostagem(
  post: {
    usuarioId: string;
    visibilidade:
      VisibilidadePostagem;
    oculto?: boolean;
  },
  viewerUsuarioId?:
    | string
    | null
) {
  if (post.oculto) {
    return false;
  }

  if (
    post.visibilidade ===
    VisibilidadePostagem.PUBLICO
  ) {
    return true;
  }

  if (!viewerUsuarioId) {
    return false;
  }

  if (
    post.usuarioId ===
    viewerUsuarioId
  ) {
    return true;
  }

  if (
    post.visibilidade ===
    VisibilidadePostagem.LOGADO
  ) {
    return true;
  }

  if (
    post.visibilidade ===
    VisibilidadePostagem.PRIVADO
  ) {
    return false;
  }

  const segue =
    await prisma.seguidor.findFirst({
      where: {
        seguidorUsuarioId:
          viewerUsuarioId,

        seguidoUsuarioId:
          post.usuarioId,
      },

      select: {
        id: true,
      },
    });

  return !!segue;
}