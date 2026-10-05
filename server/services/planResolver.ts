// server/services/planResolve
import { PrismaClient, TipoUsuario } from "@prisma/client";
import {
  getProfileIdForRole,
} from "./roles.js";
import {
  getActiveContext,
  type ActiveContext,
} from "./activeContext.js";

const prisma = new PrismaClient();

export type PlanoName = string;

export interface UserPayload {
  id: string;
  tipo: TipoUsuario;
  tipoUsuarioId?: string | null;
  plano?: PlanoName | null;  
  isAdmin?: boolean;
  parceiro: boolean;
  activeContext?: ActiveContext | null;
}

function asPlano(
  p?: string | null
): PlanoName {
  const s =
    String(p || "")
      .trim()
      .toUpperCase();

  if (!s) {
    return "FREE";
  }

  if (
    s === "ORG" ||
    s.startsWith(
      "ORGANIZACOES_"
    )
  ) {
    return "ORG";
  }

  if (
    s === "PRO" ||
    s.includes("_PRO") ||
    s.includes(
      "_LEARNING_"
    ) ||
    s === "LEARNING_3"
  ) {
    return "PRO";
  }

  return "FREE";
}

function getContextoKey(
  contexto:
    ActiveContext | null
): string | null {
  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    if (
      contexto.organizationId
    ) {
      return `organization:${contexto.organizationId}`;
    }

    if (
      contexto
        .legacyOrganizationId
    ) {
      return `organization-legacy:${contexto.legacyOrganizationId}`;
    }

    return null;
  }

  const tipo =
    contexto.role ??
    contexto.tipoUsuario;

  if (!tipo) {
    return null;
  }

  return `personal:${String(
    tipo
  )}`;
}

export async function getPlano(
  usuarioId: string
): Promise<PlanoName> {
  const activeContext =
    await getActiveContext(
      usuarioId
    );

  const contextoKey =
    getContextoKey(
      activeContext
    );

  if (!contextoKey) {
    return "FREE";
  }

  const assinatura =
    await prisma.assinatura
      .findFirst({
        where: {
          usuarioId,

          contextoKey,

          ativo:
            true,

          canceledAt:
            null,
        },

        select: {
          plano:
            true,
        },

        orderBy: {
          startsAt:
            "desc",
        },
      });

  if (assinatura) {
    return asPlano(
      assinatura.plano
    );
  }

  const pg =
    await prisma.pagamento
      .findFirst({
        where: {
          usuarioId,

          status:
            "APROVADO",

          ...(activeContext?.kind ===
          "ORGANIZATION"
            ? {
                contextoKind:
                  "ORGANIZATION",

                contextoTipo:
                  activeContext
                    .organizationType
                    ? String(
                        activeContext
                          .organizationType
                      )
                    : null,

                ...(activeContext
                  .organizationId
                  ? {
                      contextoOrganizacaoId:
                        activeContext
                          .organizationId,
                    }
                  : activeContext
                      .legacyOrganizationId
                    ? {
                        contextoLegacyOrganizationId:
                          activeContext
                            .legacyOrganizationId,
                      }
                    : {}),
              }
            : {
                contextoKind:
                  "PERSONAL",

                contextoTipo:
                  activeContext?.role
                    ? String(
                        activeContext.role
                      )
                    : activeContext
                        ?.tipoUsuario
                      ? String(
                          activeContext
                            .tipoUsuario
                        )
                      : null,

                contextoPerfilId:
                  activeContext
                    ?.profileId ??
                  activeContext
                    ?.tipoUsuarioId ??
                  null,
              }),
        },

        orderBy: {
          pagoEm:
            "desc",
        },

        select: {
          plano:
            true,

          periodicidade:
            true,

          pagoEm:
            true,
        },
      });

  if (
    pg?.pagoEm
  ) {
    const pago =
      pg.pagoEm.getTime();

    const agora =
      Date.now();

    const janela =
      pg.periodicidade ===
      "Anual"
        ? 365
        : 31;

    if (
      agora - pago <=
      janela *
        24 *
        60 *
        60 *
        1000
    ) {
      return asPlano(
        pg.plano
      );
    }
  }

  return "FREE";
}

export async function resolveUserContext(
  userId: string
): Promise<UserPayload> {
  const usuario =
    await prisma.usuario
      .findUnique({
        where: {
          id:
            userId,
        },

        include: {
          administrador:
            true,
        },
      });

  if (!usuario) {
    throw new Error(
      "Usuário não encontrado"
    );
  }

  const activeContext =
    await getActiveContext(
      usuario.id
    );

  const contextoKey =
    getContextoKey(
      activeContext
    );

  const assinaturaAtual =
    contextoKey
      ? await prisma.assinatura
          .findFirst({
            where: {
              usuarioId:
                usuario.id,

              contextoKey,

              ativo:
                true,

              canceledAt:
                null,
            },

            orderBy: [
              {
                renovaEm:
                  "desc",
              },

              {
                startsAt:
                  "desc",
              },
            ],

            select: {
              plano:
                true,
            },
          })
      : null;

  const plano: PlanoName =
    assinaturaAtual
      ? asPlano(
          assinaturaAtual
            .plano
        )
      : "FREE";

  const tipo =
    activeContext
      ?.tipoUsuario ??
    usuario.tipo;

  const tipoUsuarioId =
    activeContext
      ?.tipoUsuarioId ??
    await getProfileIdForRole(
      usuario.id,
      tipo,
    );

  return {
    id:
      usuario.id,

    tipo,

    tipoUsuarioId,

    activeContext,

    plano,

    isAdmin:
      !!usuario.administrador,

    parceiro:
      usuario.parceiro,
  };
}