import {
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  garantirOrganizacaoLegada,
} from "../services/organizacoes.js";


type TipoLegado =
  | "CLUBE"
  | "ESCOLINHA"
  | "MARCA"
  | "FEDERACAO";


type DonoOrganizacao = {
  tipo: TipoLegado;
  legacyId: string;
  usuarioId: string | null;
  organizacaoId: string;
};


async function garantirOrganizacoes() {
  const [
    clubes,
    escolinhas,
    marcas,
    federacoes,
  ] =
    await Promise.all([
      prisma.clube.findMany({
        select: {
          id: true,
          usuarioId: true,
        },
      }),

      prisma.escolinha.findMany({
        select: {
          id: true,
          usuarioId: true,
        },
      }),

      prisma.marca.findMany({
        select: {
          id: true,
          usuarioId: true,
        },
      }),

      prisma.federacao.findMany({
        select: {
          id: true,
          usuarioId: true,
        },
      }),
    ]);


  for (const item of clubes) {
    await garantirOrganizacaoLegada({
      tipo: "CLUBE",
      ownerId: item.id,
      proprietarioUsuarioId:
        item.usuarioId,
    });
  }

  for (const item of escolinhas) {
    await garantirOrganizacaoLegada({
      tipo: "ESCOLINHA",
      ownerId: item.id,
      proprietarioUsuarioId:
        item.usuarioId,
    });
  }

  for (const item of marcas) {
    await garantirOrganizacaoLegada({
      tipo: "MARCA",
      ownerId: item.id,
      proprietarioUsuarioId:
        item.usuarioId,
    });
  }

  for (const item of federacoes) {
    await garantirOrganizacaoLegada({
      tipo: "FEDERACAO",
      ownerId: item.id,
      proprietarioUsuarioId:
        item.usuarioId,
    });
  }
}


async function carregarMapas() {
  const [
    clubes,
    escolinhas,
    marcas,
    federacoes,
  ] =
    await Promise.all([
      prisma.clube.findMany({
        where: {
          organizacaoId: {
            not: null,
          },
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
        },
      }),

      prisma.escolinha.findMany({
        where: {
          organizacaoId: {
            not: null,
          },
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
        },
      }),

      prisma.marca.findMany({
        where: {
          organizacaoId: {
            not: null,
          },
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
        },
      }),

      prisma.federacao.findMany({
        where: {
          organizacaoId: {
            not: null,
          },
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
        },
      }),
    ]);


  const clubePorId =
    new Map<string, string>();

  const escolinhaPorId =
    new Map<string, string>();

  const marcaPorId =
    new Map<string, string>();

  const federacaoPorId =
    new Map<string, string>();

  const donos: DonoOrganizacao[] = [];


  for (const item of clubes) {
    if (!item.organizacaoId) {
      continue;
    }

    clubePorId.set(
      item.id,
      item.organizacaoId,
    );

    donos.push({
      tipo: "CLUBE",
      legacyId: item.id,
      usuarioId:
        item.usuarioId,
      organizacaoId:
        item.organizacaoId,
    });
  }


  for (const item of escolinhas) {
    if (!item.organizacaoId) {
      continue;
    }

    escolinhaPorId.set(
      item.id,
      item.organizacaoId,
    );

    donos.push({
      tipo: "ESCOLINHA",
      legacyId: item.id,
      usuarioId:
        item.usuarioId ?? null,
      organizacaoId:
        item.organizacaoId,
    });
  }


  for (const item of marcas) {
    if (!item.organizacaoId) {
      continue;
    }

    marcaPorId.set(
      item.id,
      item.organizacaoId,
    );

    donos.push({
      tipo: "MARCA",
      legacyId: item.id,
      usuarioId:
        item.usuarioId,
      organizacaoId:
        item.organizacaoId,
    });
  }


  for (const item of federacoes) {
    if (!item.organizacaoId) {
      continue;
    }

    federacaoPorId.set(
      item.id,
      item.organizacaoId,
    );

    donos.push({
      tipo: "FEDERACAO",
      legacyId: item.id,
      usuarioId:
        item.usuarioId,
      organizacaoId:
        item.organizacaoId,
    });
  }


  /*
   * O Seguidor antigo aponta para Usuario.
   *
   * Para não duplicar um follow em TODAS
   * as organizações de uma conta multi-papel,
   * usamos a organização correspondente
   * ao tipo atualmente ativo do usuário.
   */
  const idsUsuarios =
    Array.from(
      new Set(
        donos
          .map(
            (item) =>
              item.usuarioId
          )
          .filter(
            (
              id
            ): id is string =>
              Boolean(id)
          )
      )
    );


  const usuarios =
    idsUsuarios.length
      ? await prisma.usuario.findMany({
          where: {
            id: {
              in:
                idsUsuarios,
            },
          },

          select: {
            id: true,
            tipo: true,
          },
        })
      : [];


  const donosPorUsuario =
    new Map<
      string,
      DonoOrganizacao[]
    >();


  for (const dono of donos) {
    if (!dono.usuarioId) {
      continue;
    }

    const atual =
      donosPorUsuario.get(
        dono.usuarioId
      ) ?? [];

    atual.push(dono);

    donosPorUsuario.set(
      dono.usuarioId,
      atual
    );
  }


  const organizacaoAtivaPorUsuario =
    new Map<
      string,
      string
    >();


  for (const usuario of usuarios) {
    const candidatos =
      donosPorUsuario.get(
        usuario.id
      ) ?? [];

    let tipoEsperado:
      TipoLegado |
      null =
      null;

    switch (
      usuario.tipo
    ) {
      case TipoUsuario.Clube:
        tipoEsperado =
          "CLUBE";
        break;

      case TipoUsuario.Escola:
      case TipoUsuario.Escolinha:
        tipoEsperado =
          "ESCOLINHA";
        break;

      case TipoUsuario.Marca:
        tipoEsperado =
          "MARCA";
        break;

      case TipoUsuario.Federacao:
        tipoEsperado =
          "FEDERACAO";
        break;
    }


    if (tipoEsperado) {
      const encontrado =
        candidatos.find(
          (item) =>
            item.tipo ===
            tipoEsperado
        );

      if (encontrado) {
        organizacaoAtivaPorUsuario.set(
          usuario.id,
          encontrado.organizacaoId
        );

        continue;
      }
    }

    /*
     * Fallback seguro:
     * só usamos se a conta possuir
     * exatamente UMA organização.
     */
    if (
      candidatos.length === 1
    ) {
      organizacaoAtivaPorUsuario.set(
        usuario.id,
        candidatos[0]
          .organizacaoId
      );
    }
  }


  return {
    clubePorId,
    escolinhaPorId,
    marcaPorId,
    federacaoPorId,
    organizacaoAtivaPorUsuario,
  };
}


async function migrarPostagens(
  mapas:
    Awaited<
      ReturnType<
        typeof carregarMapas
      >
    >
) {
  let alteradas = 0;

  for (
    const [
      clubeId,
      organizacaoId,
    ] of mapas.clubePorId
  ) {
    const result =
      await prisma.postagem.updateMany({
        where: {
          clubeId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }


  for (
    const [
      escolinhaId,
      organizacaoId,
    ] of mapas.escolinhaPorId
  ) {
    const result =
      await prisma.postagem.updateMany({
        where: {
          escolinhaId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }


  /*
   * Posts antigos de Marca/Federação
   * normalmente só possuem usuarioId.
   *
   * Também cobre Clube/Escola quando
   * o post antigo não tinha clubeId/escolinhaId.
   */
  for (
    const [
      usuarioId,
      organizacaoId,
    ] of mapas
      .organizacaoAtivaPorUsuario
  ) {
    const result =
      await prisma.postagem.updateMany({
        where: {
          usuarioId,

          organizacaoId:
            null,

          clubeId:
            null,

          escolinhaId:
            null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }

  return alteradas;
}


async function migrarEventos(
  mapas:
    Awaited<
      ReturnType<
        typeof carregarMapas
      >
    >
) {
  let alterados = 0;


  for (
    const [
      clubeId,
      organizacaoId,
    ] of mapas.clubePorId
  ) {
    const result =
      await prisma.evento.updateMany({
        where: {
          clubeId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alterados +=
      result.count;
  }


  for (
    const [
      escolinhaId,
      organizacaoId,
    ] of mapas.escolinhaPorId
  ) {
    const result =
      await prisma.evento.updateMany({
        where: {
          escolinhaId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alterados +=
      result.count;
  }


  for (
    const [
      federacaoId,
      organizacaoId,
    ] of mapas.federacaoPorId
  ) {
    const result =
      await prisma.evento.updateMany({
        where: {
          federacaoId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alterados +=
      result.count;
  }


  for (
    const [
      marcaId,
      organizacaoId,
    ] of mapas.marcaPorId
  ) {
    const result =
      await prisma.evento.updateMany({
        where: {
          marcaId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alterados +=
      result.count;
  }


  /*
   * Fallback para eventos antigos
   * que só possuem creatorUsuarioId.
   */
  for (
    const [
      usuarioId,
      organizacaoId,
    ] of mapas
      .organizacaoAtivaPorUsuario
  ) {
    const result =
      await prisma.evento.updateMany({
        where: {
          organizacaoId:
            null,

          creatorUsuarioId:
            usuarioId,

          clubeId:
            null,

          escolinhaId:
            null,

          federacaoId:
            null,

          marcaId:
            null,
        },

        data: {
          organizacaoId,
        },
      });

    alterados +=
      result.count;
  }

  return alterados;
}


async function migrarTurmas(
  mapas:
    Awaited<
      ReturnType<
        typeof carregarMapas
      >
    >
) {
  let alteradas = 0;


  for (
    const [
      clubeId,
      organizacaoId,
    ] of mapas.clubePorId
  ) {
    const result =
      await prisma.turma.updateMany({
        where: {
          clubeId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }


  for (
    const [
      escolinhaId,
      organizacaoId,
    ] of mapas.escolinhaPorId
  ) {
    const result =
      await prisma.turma.updateMany({
        where: {
          escolinhaId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }

  return alteradas;
}


async function migrarRelacoesTreinamento(
  mapas:
    Awaited<
      ReturnType<
        typeof carregarMapas
      >
    >
) {
  let alteradas = 0;


  for (
    const [
      clubeId,
      organizacaoId,
    ] of mapas.clubePorId
  ) {
    const result =
      await prisma.relacaoTreinamento.updateMany({
        where: {
          clubeId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }


  for (
    const [
      escolinhaId,
      organizacaoId,
    ] of mapas.escolinhaPorId
  ) {
    const result =
      await prisma.relacaoTreinamento.updateMany({
        where: {
          escolinhaId,
          organizacaoId: null,
        },

        data: {
          organizacaoId,
        },
      });

    alteradas +=
      result.count;
  }

  return alteradas;
}


async function migrarSeguidores(
  mapas:
    Awaited<
      ReturnType<
        typeof carregarMapas
      >
    >
) {
  const seguidores =
    await prisma.seguidor.findMany({
      select: {
        seguidorUsuarioId:
          true,

        seguidoUsuarioId:
          true,
      },
    });


  const registros =
    new Map<
      string,
      {
        organizacaoId:
          string;

        usuarioId:
          string;
      }
    >();


  for (
    const relacao of seguidores
  ) {
    const organizacaoId =
      mapas
        .organizacaoAtivaPorUsuario
        .get(
          relacao
            .seguidoUsuarioId
        );

    if (!organizacaoId) {
      continue;
    }

    const key =
      `${organizacaoId}:${relacao.seguidorUsuarioId}`;

    registros.set(
      key,
      {
        organizacaoId,

        usuarioId:
          relacao.seguidorUsuarioId,
      }
    );
  }


  const dados =
    Array.from(
      registros.values()
    );


  const TAMANHO_LOTE =
    500;

  let criados = 0;


  for (
    let i = 0;
    i < dados.length;
    i += TAMANHO_LOTE
  ) {
    const lote =
      dados.slice(
        i,
        i +
          TAMANHO_LOTE
      );

    if (
      lote.length === 0
    ) {
      continue;
    }

    const result =
      await prisma.organizacaoSeguidor
        .createMany({
          data:
            lote,

          skipDuplicates:
            true,
        });

    criados +=
      result.count;
  }

  return criados;
}


async function main() {
  console.log(
    "Iniciando backfill de relacionamentos de organização..."
  );


  await garantirOrganizacoes();


  const mapas =
    await carregarMapas();


  const [
    postagensAlteradas,
    eventosAlterados,
    turmasAlteradas,
    relacoesAlteradas,
  ] =
    await Promise.all([
      migrarPostagens(
        mapas
      ),

      migrarEventos(
        mapas
      ),

      migrarTurmas(
        mapas
      ),

      migrarRelacoesTreinamento(
        mapas
      ),
    ]);


  const seguidoresCriados =
    await migrarSeguidores(
      mapas
    );


  const [
    postagensComOrganizacao,
    eventosComOrganizacao,
    turmasComOrganizacao,
    relacoesComOrganizacao,
    totalSeguidoresOrganizacao,
  ] =
    await Promise.all([
      prisma.postagem.count({
        where: {
          organizacaoId: {
            not: null,
          },
        },
      }),

      prisma.evento.count({
        where: {
          organizacaoId: {
            not: null,
          },
        },
      }),

      prisma.turma.count({
        where: {
          organizacaoId: {
            not: null,
          },
        },
      }),

      prisma.relacaoTreinamento.count({
        where: {
          organizacaoId: {
            not: null,
          },
        },
      }),

      prisma.organizacaoSeguidor.count(),
    ]);


  console.log(
    "Backfill concluído."
  );

  console.log(
    `Postagens atualizadas nesta execução: ${postagensAlteradas}`
  );

  console.log(
    `Eventos atualizados nesta execução: ${eventosAlterados}`
  );

  console.log(
    `Turmas atualizadas nesta execução: ${turmasAlteradas}`
  );

  console.log(
    `Relações de treinamento atualizadas nesta execução: ${relacoesAlteradas}`
  );

  console.log(
    `Seguidores de organização criados nesta execução: ${seguidoresCriados}`
  );

  console.log(
    `Total de postagens com organização: ${postagensComOrganizacao}`
  );

  console.log(
    `Total de eventos com organização: ${eventosComOrganizacao}`
  );

  console.log(
    `Total de turmas com organização: ${turmasComOrganizacao}`
  );

  console.log(
    `Total de relações com organização: ${relacoesComOrganizacao}`
  );

  console.log(
    `Total de seguidores de organização: ${totalSeguidoresOrganizacao}`
  );
}


main()
  .catch(
    (error) => {
      console.error(
        "Erro no backfill de relacionamentos:",
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