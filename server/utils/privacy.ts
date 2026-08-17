import { prisma } from "../prisma.js";

export function readPrivacyConfig(raw: any) {
  const c =
    raw && typeof raw === "object"
      ? raw
      : {};

  return {
    perfilVisivel: c.perfilVisivel !== false,
    permitirMensagens: c.permitirMensagens !== false,
    mostrarEmail: c.mostrarEmail === true,
    mostrarOnline: c.mostrarOnline !== false,
  };
}

async function getEntidadesDoUsuario(usuarioId: string) {
  return prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      tipo: true,
      configuracoesPrivacidade: true,

      atleta: {
        select: {
          id: true,
          clubeId: true,
          escolinhaId: true,
        },
      },

      professor: {
        select: {
          id: true,
          clubeId: true,
          escolinhaId: true,
        },
      },

      clube: {
        select: {
          id: true,
        },
      },

      escolinha: {
        select: {
          id: true,
        },
      },

      olheiro: {
        select: {
          id: true,
          clubeId: true,
          colaboracaoClubeId: true,
          colaboracaoProfessorId: true,
          colaboracaoEscolinhaId: true,
        },
      },
    },
  });
}

function relacaoClauses(usuario: any) {
  return [
    usuario?.atleta?.id
      ? { atletaId: usuario.atleta.id }
      : null,

    usuario?.professor?.id
      ? { professorId: usuario.professor.id }
      : null,

    usuario?.clube?.id
      ? { clubeId: usuario.clube.id }
      : null,

    usuario?.escolinha?.id
      ? { escolinhaId: usuario.escolinha.id }
      : null,
  ].filter(Boolean) as any[];
}

export async function existeVinculoFormal(
  viewerUsuarioId: string,
  targetUsuarioId: string
) {
  if (!viewerUsuarioId || !targetUsuarioId) return false;

  if (viewerUsuarioId === targetUsuarioId) {
    return true;
  }

  const [viewer, target] = await Promise.all([
    getEntidadesDoUsuario(viewerUsuarioId),
    getEntidadesDoUsuario(targetUsuarioId),
  ]);

  if (!viewer || !target) return false;

  const viewerClauses = relacaoClauses(viewer);
  const targetClauses = relacaoClauses(target);

  if (viewerClauses.length && targetClauses.length) {
    const relacao = await prisma.relacaoTreinamento.findFirst({
      where: {
        ativo: true,
        encerradoEm: null,

        AND: [
          { OR: viewerClauses },
          { OR: targetClauses },
        ],
      },
      select: {
        id: true,
      },
    });

    if (relacao) return true;
  }

  if (
    viewer.atleta?.clubeId &&
    target.clube?.id === viewer.atleta.clubeId
  ) {
    return true;
  }

  if (
    target.atleta?.clubeId &&
    viewer.clube?.id === target.atleta.clubeId
  ) {
    return true;
  }

  if (
    viewer.atleta?.escolinhaId &&
    target.escolinha?.id === viewer.atleta.escolinhaId
  ) {
    return true;
  }

  if (
    target.atleta?.escolinhaId &&
    viewer.escolinha?.id === target.atleta.escolinhaId
  ) {
    return true;
  }

  if (
    viewer.professor?.clubeId &&
    target.clube?.id === viewer.professor.clubeId
  ) {
    return true;
  }

  if (
    target.professor?.clubeId &&
    viewer.clube?.id === target.professor.clubeId
  ) {
    return true;
  }

  if (
    viewer.professor?.escolinhaId &&
    target.escolinha?.id === viewer.professor.escolinhaId
  ) {
    return true;
  }

  if (
    target.professor?.escolinhaId &&
    viewer.escolinha?.id === target.professor.escolinhaId
  ) {
    return true;
  }

  if (viewer.professor?.id && target.clube?.id) {
    const row = await prisma.professorClube.findFirst({
      where: {
        professorId: viewer.professor.id,
        clubeId: target.clube.id,
      },
      select: { id: true },
    });

    if (row) return true;
  }

  if (target.professor?.id && viewer.clube?.id) {
    const row = await prisma.professorClube.findFirst({
      where: {
        professorId: target.professor.id,
        clubeId: viewer.clube.id,
      },
      select: { id: true },
    });

    if (row) return true;
  }

  if (viewer.professor?.id && target.escolinha?.id) {
    const row = await prisma.professorEscolinha.findFirst({
      where: {
        professorId: viewer.professor.id,
        escolinhaId: target.escolinha.id,
      },
      select: { id: true },
    });

    if (row) return true;
  }

  if (target.professor?.id && viewer.escolinha?.id) {
    const row = await prisma.professorEscolinha.findFirst({
      where: {
        professorId: target.professor.id,
        escolinhaId: viewer.escolinha.id,
      },
      select: { id: true },
    });

    if (row) return true;
  }

  if (viewer.olheiro) {
    if (
      target.clube?.id &&
      (
        viewer.olheiro.clubeId === target.clube.id ||
        viewer.olheiro.colaboracaoClubeId === target.clube.id
      )
    ) {
      return true;
    }

    if (
      target.professor?.id &&
      viewer.olheiro.colaboracaoProfessorId === target.professor.id
    ) {
      return true;
    }

    if (
      target.escolinha?.id &&
      viewer.olheiro.colaboracaoEscolinhaId === target.escolinha.id
    ) {
      return true;
    }
  }

  if (target.olheiro) {
    if (
      viewer.clube?.id &&
      (
        target.olheiro.clubeId === viewer.clube.id ||
        target.olheiro.colaboracaoClubeId === viewer.clube.id
      )
    ) {
      return true;
    }

    if (
      viewer.professor?.id &&
      target.olheiro.colaboracaoProfessorId === viewer.professor.id
    ) {
      return true;
    }

    if (
      viewer.escolinha?.id &&
      target.olheiro.colaboracaoEscolinhaId === viewer.escolinha.id
    ) {
      return true;
    }
  }

  return false;
}

async function saoSeguidoresMutuos(
  usuarioAId: string,
  usuarioBId: string
) {
  if (
    !usuarioAId ||
    !usuarioBId ||
    usuarioAId === usuarioBId
  ) {
    return false;
  }

  const [aSegueB, bSegueA] =
    await Promise.all([
      prisma.seguidor.findFirst({
        where: {
          seguidorUsuarioId: usuarioAId,
          seguidoUsuarioId: usuarioBId,
        },
        select: {
          id: true,
        },
      }),

      prisma.seguidor.findFirst({
        where: {
          seguidorUsuarioId: usuarioBId,
          seguidoUsuarioId: usuarioAId,
        },
        select: {
          id: true,
        },
      }),
    ]);

  return !!aSegueB && !!bSegueA;
}

export async function podeVerPresenca(
  viewerUsuarioId: string,
  targetUsuarioId: string
) {
  if (
    !viewerUsuarioId ||
    !targetUsuarioId
  ) {
    return false;
  }

  if (
    viewerUsuarioId ===
    targetUsuarioId
  ) {
    return true;
  }

  const target =
    await prisma.usuario.findUnique({
      where: {
        id: targetUsuarioId,
      },

      select: {
        id: true,

        configuracoesPrivacidade:
          true,
      },
    });

  if (!target) {
    return false;
  }

  const priv =
    readPrivacyConfig(
      target
        .configuracoesPrivacidade
    );

  if (!priv.mostrarOnline) {
    return false;
  }

  const [
    vinculo,
    seguidoresMutuos,
  ] = await Promise.all([
    existeVinculoFormal(
      viewerUsuarioId,
      targetUsuarioId
    ),

    saoSeguidoresMutuos(
      viewerUsuarioId,
      targetUsuarioId
    ),
  ]);

  return (
    vinculo ||
    seguidoresMutuos
  );
}

export async function avaliarPrivacidadePerfil(
  viewerUsuarioId: string | null | undefined,
  targetUsuarioId: string
) {
  const [target, viewer] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: targetUsuarioId },
      select: {
        id: true,
        configuracoesPrivacidade: true,
      },
    }),

    viewerUsuarioId
      ? prisma.usuario.findUnique({
          where: { id: viewerUsuarioId },
          select: {
            id: true,
            tipo: true,
          },
        })
      : null,
  ]);

  if (!target) {
    return {
      existe: false,
      podeVerPerfil: false,
      podeMostrarEmail: false,
      mostrarOnline: false,
      permitirMensagens: false,
    };
  }

  const priv = readPrivacyConfig(
    target.configuracoesPrivacidade
  );

  const isOwn =
    !!viewerUsuarioId &&
    viewerUsuarioId === targetUsuarioId;

  const isAdmin =
    String(viewer?.tipo || "").toLowerCase() ===
    "admin";

  let temVinculo = false;
  let seguidoresMutuos = false;

  if (
    !priv.perfilVisivel &&
    !isOwn &&
    !isAdmin &&
    viewerUsuarioId
    ) {
    const [vinculo, mutuos] =
        await Promise.all([
        existeVinculoFormal(
            viewerUsuarioId,
            targetUsuarioId
        ),

        saoSeguidoresMutuos(
            viewerUsuarioId,
            targetUsuarioId
        ),
        ]);

    temVinculo = vinculo;
    seguidoresMutuos = mutuos;
  }

  return {
    existe: true,

    podeVerPerfil:
      priv.perfilVisivel ||
      isOwn ||
      isAdmin ||
      temVinculo ||
      seguidoresMutuos,

    podeMostrarEmail:
      priv.mostrarEmail ||
      isOwn ||
      isAdmin,

    mostrarOnline:
      priv.mostrarOnline ||
      isOwn ||
      isAdmin,

    permitirMensagens:
      priv.permitirMensagens,

    temVinculo,
    seguidoresMutuos,
    isOwn,
    isAdmin,
  };
}