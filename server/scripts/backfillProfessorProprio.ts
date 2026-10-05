import {
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  sincronizarProfessorProprio,
} from "../services/organizacoes.js";

async function main() {
  console.log(
    "[backfillProfessorProprio] iniciando..."
  );

  const papeisProfessor =
    await prisma.usuarioPapel.findMany({
      where: {
        papel:
          TipoUsuario.Professor,

        status:
          StatusUsuarioPapel.ATIVO,
      },

      select: {
        usuarioId: true,
      },
    });

  const usuarioIds =
    Array.from(
      new Set(
        papeisProfessor.map(
          (item) =>
            item.usuarioId
        )
      )
    );

  console.log(
    `[backfillProfessorProprio] ${usuarioIds.length} usuário(s) com Professor ATIVO.`
  );

  let processados = 0;
  let vinculados = 0;

  for (
    const usuarioId of
      usuarioIds
  ) {
    const [
      professor,
      clubes,
      escolinhas,
    ] = await Promise.all([
      prisma.professor.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,
          nome: true,
        },
      }),

      prisma.clube.findMany({
        where: {
          usuarioId,
        },

        select: {
          id: true,
          nome: true,
        },
      }),

      prisma.escolinha.findMany({
        where: {
          usuarioId,
        },

        select: {
          id: true,
          nome: true,
        },
      }),
    ]);

    processados++;

    if (!professor) {
      console.warn(
        `[IGNORADO] ${usuarioId}: Professor ATIVO, mas sem registro em Professor.`
      );

      continue;
    }

    if (
      clubes.length === 0 &&
      escolinhas.length === 0
    ) {
      continue;
    }

    console.log(
      `\n[SYNC] ${professor.nome ?? usuarioId}`
    );

    if (clubes.length) {
      console.log(
        `  clubes: ${clubes
          .map((c) => c.nome)
          .join(", ")}`
      );
    }

    if (escolinhas.length) {
      console.log(
        `  escolinhas: ${escolinhas
          .map((e) => e.nome)
          .join(", ")}`
      );
    }

    await sincronizarProfessorProprio({
      usuarioId,
    });

    vinculados++;
  }

  console.log(
    "\n[backfillProfessorProprio] concluído."
  );

  console.log({
    professoresAtivos:
      usuarioIds.length,

    processados,

    contasComOrganizacao:
      vinculados,
  });
}

main()
  .catch((error) => {
    console.error(
      "[backfillProfessorProprio] erro:",
      error
    );

    process.exitCode = 1;
  })
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );