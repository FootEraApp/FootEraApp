
import {
  Prisma,
  VisibilidadePostagem,
} from "@prisma/client";

import { avaliarPrivacidadePerfil } from "./privacy.js";
import { prisma } from "../prisma.js";
import { getActiveContext } from "../services/activeContext.js";
import { canPermission } from "../services/permissions.js";

// Normaliza a visibilidade recebida do frontend.
export function normalizarVisibilidadePostagem(
  value: unknown,
  fallback: VisibilidadePostagem =
    VisibilidadePostagem.LOGADO
): VisibilidadePostagem {
  const raw = String(value ?? "")
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

// Filtro inicial das publicações no banco.
export async function getPostVisibilityWhere(
  viewerUsuarioId?: string | null
): Promise<Prisma.PostagemWhereInput> {
  if (!viewerUsuarioId) {
    return {
      oculto: false,
      visibilidade: VisibilidadePostagem.PUBLICO,
    };
  }

  const [seguindoPessoas, seguindoOrganizacoes, contexto] =
    await Promise.all([
      prisma.seguidor.findMany({
        where: {
          seguidorUsuarioId: viewerUsuarioId,
        },
        select: {
          seguidoUsuarioId: true,
        },
      }),

      prisma.organizacaoSeguidor.findMany({
        where: {
          usuarioId: viewerUsuarioId,
        },
        select: {
          organizacaoId: true,
        },
      }),

      getActiveContext(viewerUsuarioId),
    ]);

  const pessoasIds = seguindoPessoas.map(
    (item) => item.seguidoUsuarioId
  );

  const organizacoesIds = seguindoOrganizacoes.map(
    (item) => item.organizacaoId
  );

  const permitido: Prisma.PostagemWhereInput[] = [
    {
      visibilidade: VisibilidadePostagem.PUBLICO,
    },
    {
      visibilidade: VisibilidadePostagem.LOGADO,
    },
    {
      // Posts pessoais do próprio usuário.
      usuarioId: viewerUsuarioId,
      organizacaoId: null,
    },
  ];

  // Publicações pessoais dos usuários seguidos.
  if (pessoasIds.length > 0) {
    permitido.push({
      organizacaoId: null,
      visibilidade: VisibilidadePostagem.SEGUIDORES,
      usuarioId: {
        in: pessoasIds,
      },
    });
  }

  // Publicações de organizações seguidas.
  if (organizacoesIds.length > 0) {
    permitido.push({
      visibilidade: VisibilidadePostagem.SEGUIDORES,
      organizacaoId: {
        in: organizacoesIds,
      },
    });
  }

  // Publicações privadas da organização ativa,
  // sujeitas a uma segunda verificação de permissão.
  if (
    contexto?.kind === "ORGANIZATION" &&
    contexto.organizationId
  ) {
    const podeGerenciar = await canPermission(
      viewerUsuarioId,
      "GERENCIAR_ORGANIZACAO"
    );

    if (podeGerenciar) {
      permitido.push({
        organizacaoId: contexto.organizationId,
        visibilidade: VisibilidadePostagem.PRIVADO,
      });
    }
  }

  return {
    oculto: false,
    OR: permitido,
  };
}

// Verificação completa de acesso à publicação.
export async function podeVisualizarPostagem(
  post: {
    usuarioId: string | null;
    organizacaoId?: string | null;
    visibilidade: VisibilidadePostagem;
    oculto?: boolean;
  },
  viewerUsuarioId?: string | null
): Promise<boolean> {
  if (post.oculto) {
    return false;
  }

  // ====================================
  // PUBLICAÇÃO INSTITUCIONAL
  // ====================================
  if (post.organizacaoId) {
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
      post.visibilidade ===
      VisibilidadePostagem.LOGADO
    ) {
      return true;
    }

    // O gestor da organização pode ver
    // seus próprios conteúdos, inclusive
    // aqueles restritos a seguidores.
    const contexto = await getActiveContext(
      viewerUsuarioId
    );

    const mesmaOrganizacao =
      contexto?.kind === "ORGANIZATION" &&
      contexto.organizationId === post.organizacaoId;

    if (mesmaOrganizacao) {
      const podeGerenciar = await canPermission(
        viewerUsuarioId,
        "GERENCIAR_ORGANIZACAO"
      );

      if (podeGerenciar) {
        return true;
      }
    }

    if (
      post.visibilidade ===
      VisibilidadePostagem.SEGUIDORES
    ) {
      const segueOrganizacao =
        await prisma.organizacaoSeguidor.findUnique({
          where: {
            organizacaoId_usuarioId: {
              organizacaoId: post.organizacaoId,
              usuarioId: viewerUsuarioId,
            },
          },
          select: {
            organizacaoId: true,
          },
        });

      return Boolean(segueOrganizacao);
    }

    // PRIVADO: somente gestor autorizado.
    return false;
  }

  // ====================================
  // PUBLICAÇÃO PESSOAL
  // ====================================
  if (!post.usuarioId) {
    // Publicação pessoal sem autor válido.
    return false;
  }

  const acessoPerfil = await avaliarPrivacidadePerfil(
    viewerUsuarioId,
    post.usuarioId
  );

  if (!acessoPerfil.podeVerPerfil) {
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

  // Autor pessoal pode ver suas publicações.
  if (post.usuarioId === viewerUsuarioId) {
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

  if (
    post.visibilidade ===
    VisibilidadePostagem.SEGUIDORES
  ) {
    const seguePessoa = await prisma.seguidor.findFirst({
      where: {
        seguidorUsuarioId: viewerUsuarioId,
        seguidoUsuarioId: post.usuarioId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(seguePessoa);
  }

  return false;
}