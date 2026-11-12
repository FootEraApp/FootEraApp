
import { prisma } from "./server/prisma.js";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");

  if (
    process.env.NODE_ENV !== "test" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("BANCO_QA_INCORRETO");
  }

  const privadoId =
    process.env.CHAT_AUDIO_MENSAGEM_PRIVADA_ID?.trim();

  const grupoId =
    process.env.CHAT_AUDIO_GRUPO_ID?.trim();

  const grupoMensagemId =
    process.env.CHAT_AUDIO_MENSAGEM_GRUPO_ID?.trim();

  if (!privadoId) {
    throw new Error("FALTA_ID_AUDIO_PRIVADO");
  }

  console.log("BANCO:", url.pathname);

  const privada = await prisma.mensagem.findUnique({
    where: { id: privadoId },
    select: {
      id: true,
      tipo: true,
      deId: true,
      paraId: true,
      audioKey: true,
      audioMime: true,
      audioDuracaoMs: true,
    },
  });

  if (!privada) {
    console.log(
      "PRIVADO: NAO_ENCONTRADO_NO_BANCO_QA"
    );
  } else {
    console.log("PRIVADO:", {
      id: privada.id,
      tipo: privada.tipo,
      deId: privada.deId,
      paraId: privada.paraId,
      possuiAudioKey: Boolean(privada.audioKey),
      mime: privada.audioMime,
      duracaoMs: privada.audioDuracaoMs,
    });
  }

  if (grupoId && grupoMensagemId) {
    const grupo = await prisma.mensagemGrupo.findFirst({
      where: {
        id: grupoMensagemId,
        grupoId,
      },
      select: {
        id: true,
        grupoId: true,
        usuarioId: true,
        tipo: true,
        audioKey: true,
        excluida: true,
      },
    });

    console.log(
      "GRUPO_AUDIO:",
      grupo
        ? {
            id: grupo.id,
            grupoId: grupo.grupoId,
            tipo: grupo.tipo,
            remetenteId: grupo.usuarioId,
            possuiAudioKey: Boolean(grupo.audioKey),
            excluida: grupo.excluida,
          }
        : "NAO_ENCONTRADO_NO_BANCO_QA"
    );

    const membros = await prisma.membroGrupo.findMany({
      where: { grupoId },
      select: {
        usuarioId: true,
      },
    });

    console.log(
      "GRUPO_MEMBROS_IDS:",
      membros.map((m) => m.usuarioId)
    );
  }

  if (
    privada?.tipo === "AUDIO" &&
    privada.audioKey
  ) {
    console.log("PRIVADO_REGISTRO_OK");
  }

  console.log("DIAGNOSTICO_CONCLUIDO");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });