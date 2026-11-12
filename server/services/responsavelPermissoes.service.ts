
import {
  StatusResponsavelAtleta,
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

import { prisma } from "../prisma.js";
import { getActiveContext } from "./activeContext.js";

export type PermissaoResponsavelAtleta =
  | "podeEditarPerfil"
  | "podeGerenciarPrivacidade"
  | "podeGerenciarTreinos"
  | "podeGerenciarConteudo";

type VerificarPermissaoParams = {
  responsavelUsuarioId: string;
  atletaId: string;
  permissao: PermissaoResponsavelAtleta;
};

export async function verificarPermissaoResponsavelAtleta({
  responsavelUsuarioId,
  atletaId,
  permissao,
}: VerificarPermissaoParams): Promise<boolean> {
  if (!responsavelUsuarioId || !atletaId) {
    return false;
  }

  const contexto = await getActiveContext(
    responsavelUsuarioId
  );

  if (
    contexto?.kind !== "PERSONAL" ||
    contexto.tipoUsuario !== TipoUsuario.Responsavel
  ) {
    return false;
  }

  const papel = await prisma.usuarioPapel.findUnique({
    where: {
      usuarioId_papel: {
        usuarioId: responsavelUsuarioId,
        papel: TipoUsuario.Responsavel,
      },
    },
    select: {
      status: true,
    },
  });

  if (papel?.status !== StatusUsuarioPapel.ATIVO) {
    return false;
  }

  const vinculo = await prisma.responsavelAtleta.findUnique({
    where: {
      responsavelUsuarioId_atletaId: {
        responsavelUsuarioId,
        atletaId,
      },
    },
    select: {
      status: true,
      principal: true,
      podeEditarPerfil: true,
      podeGerenciarPrivacidade: true,
      podeGerenciarTreinos: true,
      podeGerenciarConteudo: true,
    },
  });

  if (
    !vinculo ||
    vinculo.status !== StatusResponsavelAtleta.ATIVO
  ) {
    return false;
  }
  
  if (vinculo.principal) {
    return true;
  }

  return vinculo[permissao] === true;
}