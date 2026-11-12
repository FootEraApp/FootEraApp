
import { prisma } from "../prisma.js";

export async function contarMensagensGrupoNaoLidas(
  usuarioId: string
): Promise<number> {
  const participacoes = await prisma.membroGrupo.findMany({
    where: {
      usuarioId,
    },
    select: {
      grupoId: true,
      ultimaLeituraEm: true,
    },
  });

  if (!participacoes.length) {
    return 0;
  }

  const contagens = await Promise.all(
    participacoes.map((participacao) =>
      prisma.mensagemGrupo.count({
        where: {
          grupoId: participacao.grupoId,
          usuarioId: {
            not: usuarioId,
          },
          excluida: false,
          criadaEm: {
            gt: participacao.ultimaLeituraEm,
          },
        },
      })
    )
  );

  return contagens.reduce(
    (total, quantidade) => total + quantidade,
    0
  );
}

export async function contarMensagensNaoLidas(
  usuarioId: string
) {
  const [privadas, grupos] = await Promise.all([
    prisma.mensagem.count({
      where: {
        paraId: usuarioId,
        lida: false,
      },
    }),
    contarMensagensGrupoNaoLidas(usuarioId),
  ]);

  return {
    privadas,
    grupos,
    total: privadas + grupos,
  };
}