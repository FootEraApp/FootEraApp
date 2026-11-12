
import {
  CreatorTipo,
  FuncaoMembroOrganizacao,
  TipoUsuario,
} from "@prisma/client";

import { prisma } from "../prisma.js";
import { getActiveContext } from "./activeContext.js";
import { hasRole } from "./roles.js";

export class CreatorContextError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CreatorContextError";
  }
}

export type CreatorContextResolution = {
  usuarioId: string;
  creatorId: string;
  creator: NonNullable<
    Awaited<ReturnType<typeof prisma.creator.findFirst>>
  >;
  kind: "PERSONAL" | "ORGANIZATION";
  organizacaoId: string | null;
};

export async function resolverCreatorAdministravel(
  usuarioId: string
): Promise<CreatorContextResolution> {
  const contexto = await getActiveContext(usuarioId);

  if (!contexto) {
    throw new CreatorContextError(
      403,
      "ACTIVE_CONTEXT_REQUIRED",
      "Selecione um perfil ativo."
    );
  }

  if (contexto.kind === "ORGANIZATION") {
    const organizacaoId = contexto.organizationId;

    if (!organizacaoId) {
      throw new CreatorContextError(
        403,
        "ORGANIZATION_CONTEXT_INVALID",
        "O contexto da organização é inválido."
      );
    }

    const membro = await prisma.membroOrganizacao.findUnique({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId,
          usuarioId,
        },
      },
      select: {
        ativo: true,
        funcao: true,
        organizacao: {
          select: {
            ativo: true,
          },
        },
      },
    });

    const podeAdministrar =
      membro?.ativo === true &&
      membro.organizacao.ativo === true &&
      (
        membro.funcao ===
          FuncaoMembroOrganizacao.PROPRIETARIO ||
        membro.funcao ===
          FuncaoMembroOrganizacao.ADMINISTRADOR
      );

    if (!podeAdministrar) {
      throw new CreatorContextError(
        403,
        "CREATOR_ORGANIZATION_ACCESS_DENIED",
        "Você não tem permissão para administrar o Creator desta organização."
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { organizacaoId },
    });

    if (!creator) {
      throw new CreatorContextError(
        404,
        "INSTITUTIONAL_CREATOR_NOT_FOUND",
        "Esta organização ainda não possui um Creator institucional vinculado."
      );
    }

    if (
      !creator.ativo ||
      creator.tipo !== CreatorTipo.INSTITUCIONAL
    ) {
      throw new CreatorContextError(
        409,
        "INSTITUTIONAL_CREATOR_UNAVAILABLE",
        "O Creator institucional está indisponível ou possui uma configuração inconsistente."
      );
    }

    return {
      usuarioId,
      creatorId: creator.id,
      creator,
      kind: "ORGANIZATION",
      organizacaoId,
    };
  }

  if (contexto.tipoUsuario !== TipoUsuario.Creator) {
    throw new CreatorContextError(
      403,
      "CREATOR_CONTEXT_REQUIRED",
      "Selecione seu perfil Creator ou a organização correspondente."
    );
  }

  const possuiPapel = await hasRole(
    usuarioId,
    TipoUsuario.Creator
  );

  if (!possuiPapel) {
    throw new CreatorContextError(
      403,
      "CREATOR_ROLE_REQUIRED",
      "Seu papel Creator não está ativo."
    );
  }

  const creator = await prisma.creator.findUnique({
    where: { usuarioId },
  });

  if (!creator) {
    throw new CreatorContextError(
      404,
      "PERSONAL_CREATOR_NOT_FOUND",
      "Esta conta não possui um Creator pessoal."
    );
  }

  if (
    creator.organizacaoId !== null ||
    creator.tipo !== CreatorTipo.PESSOA_FISICA
  ) {
    throw new CreatorContextError(
      403,
      "CREATOR_BELONGS_TO_ORGANIZATION",
      "Este Creator é institucional. Selecione o perfil da organização para administrá-lo."
    );
  }

  if (!creator.ativo) {
    throw new CreatorContextError(
      409,
      "CREATOR_INACTIVE",
      "Este Creator está inativo."
    );
  }

  return {
    usuarioId,
    creatorId: creator.id,
    creator,
    kind: "PERSONAL",
    organizacaoId: null,
  };
}