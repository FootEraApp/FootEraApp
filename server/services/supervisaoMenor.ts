import {
  StatusResponsavelAtleta,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

function calcularIdade(
  dataNascimento:
    | Date
    | null
    | undefined
) {
  if (!dataNascimento) {
    return null;
  }

  const hoje =
    new Date();

  let idade =
    hoje.getFullYear() -
    dataNascimento.getFullYear();

  const aindaNaoFezAniversario =
    hoje.getMonth() <
      dataNascimento.getMonth() ||
    (
      hoje.getMonth() ===
        dataNascimento.getMonth() &&
      hoje.getDate() <
        dataNascimento.getDate()
    );

  if (
    aindaNaoFezAniversario
  ) {
    idade--;
  }

  return Math.max(
    0,
    idade
  );
}

export async function obterSupervisaoMenor(
  usuarioId: string
) {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },

      select: {
        dataNascimento:
          true,

        atleta: {
          select: {
            id:
              true,

            idade:
              true,

            responsaveis: {
              where: {
                status:
                  StatusResponsavelAtleta.ATIVO,
              },

              select: {
                id:
                  true,

                principal:
                  true,

                responsavelUsuarioId:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !usuario?.atleta
  ) {
    return {
      supervisionado:
        false,

      idade:
        null,

      atletaId:
        null,

      responsavelPrincipalUsuarioId:
        null,
    };
  }

  const idade =
    calcularIdade(
      usuario.dataNascimento
    ) ??
    usuario.atleta.idade ??
    null;

  const responsavelPrincipal =
    usuario.atleta
      .responsaveis
      .find(
        (vinculo) =>
          vinculo.principal ===
          true
      ) ??
    usuario.atleta
      .responsaveis[0] ??
    null;

  const supervisionado =
    idade !== null &&
    idade < 12 &&
    usuario.atleta
      .responsaveis
      .length > 0;

  return {
    supervisionado,

    idade,

    atletaId:
      usuario.atleta.id,

    responsavelPrincipalUsuarioId:
      responsavelPrincipal
        ?.responsavelUsuarioId ??
      null,
  };
}