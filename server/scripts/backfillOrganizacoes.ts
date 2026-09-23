import {
  FuncaoMembroOrganizacao,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  garantirOrganizacaoLegada,
  sincronizarMembroOrganizacaoLegada,
} from "../services/organizacoes.js";


async function main() {
  console.log(
    "Iniciando backfill de organizações..."
  );

  const clubes =
    await prisma.clube.findMany({
      select: {
        id: true,
        usuarioId: true,
      },
    });

  for (
    const clube of clubes
  ) {
    await garantirOrganizacaoLegada({
      tipo:
        "CLUBE",

      ownerId:
        clube.id,

      proprietarioUsuarioId:
        clube.usuarioId,
    });
  }


  const escolinhas =
    await prisma.escolinha.findMany({
      select: {
        id: true,
        usuarioId: true,
      },
    });

  for (
    const escolinha of escolinhas
  ) {
    await garantirOrganizacaoLegada({
      tipo:
        "ESCOLINHA",

      ownerId:
        escolinha.id,

      proprietarioUsuarioId:
        escolinha.usuarioId,
    });
  }


  const marcas =
    await prisma.marca.findMany({
      select: {
        id: true,
        usuarioId: true,
      },
    });

  for (
    const marca of marcas
  ) {
    await garantirOrganizacaoLegada({
      tipo:
        "MARCA",

      ownerId:
        marca.id,

      proprietarioUsuarioId:
        marca.usuarioId,
    });
  }


  const federacoes =
    await prisma.federacao.findMany({
      select: {
        id: true,
        usuarioId: true,
      },
    });

  for (
    const federacao of federacoes
  ) {
    await garantirOrganizacaoLegada({
      tipo:
        "FEDERACAO",

      ownerId:
        federacao.id,

      proprietarioUsuarioId:
        federacao.usuarioId,
    });
  }

  const professorClubes =
    await prisma.professorClube.findMany({
      select: {
        clubeId: true,

        professor: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

  for (
    const item of professorClubes
  ) {
    const usuarioId =
      item.professor
        ?.usuarioId;

    if (!usuarioId) {
      continue;
    }

    await sincronizarMembroOrganizacaoLegada({
      tipo:
        "CLUBE",

      ownerId:
        item.clubeId,

      usuarioId,

      funcao:
        FuncaoMembroOrganizacao.PROFESSOR,
    });
  }

  const professorEscolinhas =
    await prisma.professorEscolinha.findMany({
      select: {
        escolinhaId: true,

        professor: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

  for (
    const item of professorEscolinhas
  ) {
    const usuarioId =
      item.professor
        ?.usuarioId;

    if (!usuarioId) {
      continue;
    }

    await sincronizarMembroOrganizacaoLegada({
      tipo:
        "ESCOLINHA",

      ownerId:
        item.escolinhaId,

      usuarioId,

      funcao:
        FuncaoMembroOrganizacao.PROFESSOR,
    });
  }

  const gestores =
    await prisma.organizacaoGestor.findMany({
      where: {
        ativo: true,
      },

      select: {
        tipo: true,
        ownerId: true,
        papel: true,
        permissoes: true,

        professor: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

  for (
    const gestor of gestores
  ) {
    const usuarioId =
      gestor.professor
        ?.usuarioId;

    if (!usuarioId) {
      continue;
    }

    const possuiPoderGestao =
      gestor.permissoes !=
        null ||
      Boolean(
        String(
          gestor.papel ||
            ""
        ).trim()
      );

    await sincronizarMembroOrganizacaoLegada({
      tipo:
        String(
          gestor.tipo
        ) === "CLUBE"
          ? "CLUBE"
          : "ESCOLINHA",

      ownerId:
        gestor.ownerId,

      usuarioId,

      funcao:
        possuiPoderGestao
          ? FuncaoMembroOrganizacao.ADMINISTRADOR
          : FuncaoMembroOrganizacao.PROFESSOR,

      permissoes:
        gestor.permissoes,
    });
  }

  const atletas =
    await prisma.atleta.findMany({
      select: {
        usuarioId: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

  for (
    const atleta of atletas
  ) {
    if (
      atleta.clubeId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          "CLUBE",

        ownerId:
          atleta.clubeId,

        usuarioId:
          atleta.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.MEMBRO,
      });
    }

    if (
      atleta.escolinhaId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          "ESCOLINHA",

        ownerId:
          atleta.escolinhaId,

        usuarioId:
          atleta.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.MEMBRO,
      });
    }
  }
  
  const relacoes =
    await prisma.relacaoTreinamento.findMany({
      where: {
        ativo: true,
        encerradoEm: null,

        OR: [
          {
            clubeId: {
              not: null,
            },
          },
          {
            escolinhaId: {
              not: null,
            },
          },
        ],
      },

      select: {
        clubeId: true,
        escolinhaId: true,

        atleta: {
          select: {
            usuarioId: true,
          },
        },

        professor: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

  for (
    const relacao of relacoes
  ) {
    const tipo =
      relacao.clubeId
        ? "CLUBE"
        : "ESCOLINHA";

    const ownerId =
      relacao.clubeId ??
      relacao.escolinhaId;

    if (!ownerId) {
      continue;
    }

    if (
      relacao.atleta
        ?.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo,

        ownerId,

        usuarioId:
          relacao.atleta
            .usuarioId,

        funcao:
          FuncaoMembroOrganizacao.MEMBRO,
      });
    }

    if (
      relacao.professor
        ?.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo,

        ownerId,

        usuarioId:
          relacao.professor
            .usuarioId,

        funcao:
          FuncaoMembroOrganizacao.PROFESSOR,
      });
    }
  }


  const [
    totalOrganizacoes,
    totalMembros,
  ] =
    await Promise.all([
      prisma.organizacao.count(),
      prisma.membroOrganizacao.count(),
    ]);

  console.log(
    `Backfill concluído. Organizações: ${totalOrganizacoes}. Membros: ${totalMembros}.`
  );
}


main()
  .catch((error) => {
    console.error(
      "Erro no backfill:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });