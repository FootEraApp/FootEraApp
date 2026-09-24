import {
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";


async function main() {
  console.log(
    "Iniciando backfill de activeContext..."
  );

  const usuarios =
    await prisma.usuario.findMany({
      where: {
        contextoOrganizacaoId:
          null,

        tipo: {
          in: [
            TipoUsuario.Clube,
            TipoUsuario.Escola,
            TipoUsuario.Escolinha,
            TipoUsuario.Marca,
            TipoUsuario.Federacao,
          ],
        },
      },

      select: {
        id: true,
        tipo: true,

        clube: {
          select: {
            organizacaoId:
              true,
          },
        },

        escolinha: {
          select: {
            organizacaoId:
              true,
          },
        },

        marca: {
          select: {
            organizacaoId:
              true,
          },
        },

        federacao: {
          select: {
            organizacaoId:
              true,
          },
        },
      },
    });

  let atualizados = 0;
  let ignorados = 0;

  for (
    const usuario of usuarios
  ) {
    let organizacaoId:
      string | null =
      null;

    switch (
      usuario.tipo
    ) {
      case TipoUsuario.Clube:
        organizacaoId =
          usuario.clube
            ?.organizacaoId ??
          null;
        break;

      case TipoUsuario.Escola:
      case TipoUsuario.Escolinha:
        organizacaoId =
          usuario.escolinha
            ?.organizacaoId ??
          null;
        break;

      case TipoUsuario.Marca:
        organizacaoId =
          usuario.marca
            ?.organizacaoId ??
          null;
        break;

      case TipoUsuario.Federacao:
        organizacaoId =
          usuario.federacao
            ?.organizacaoId ??
          null;
        break;
    }

    if (!organizacaoId) {
      ignorados++;
      continue;
    }

    const membro =
      await prisma.membroOrganizacao.findUnique({
        where: {
          organizacaoId_usuarioId: {
            organizacaoId,
            usuarioId:
              usuario.id,
          },
        },

        select: {
          ativo: true,
        },
      });

    if (
      !membro?.ativo
    ) {
      ignorados++;
      continue;
    }

    await prisma.usuario.update({
      where: {
        id:
          usuario.id,
      },

      data: {
        contextoOrganizacaoId:
          organizacaoId,
      },
    });

    atualizados++;
  }

  console.log(
    "Backfill concluído."
  );

  console.log(
    `Contextos atualizados: ${atualizados}`
  );

  console.log(
    `Contextos ignorados: ${ignorados}`
  );
}


main()
  .catch(
    (error) => {
      console.error(
        "Erro no backfill de activeContext:",
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );