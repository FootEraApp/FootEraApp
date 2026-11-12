
import { readFile } from "node:fs/promises";
import { prisma } from "./server/prisma.js";
import {
  gravarChatAudio,
  lerChatAudio,
  removerChatAudio,
} from "./server/services/chatAudioStorage.js";
import {
  recuperarExclusoesChatAudio,
} from "./server/services/chatAudioExclusaoService.js";

async function main() {
  const banco = new URL(
    process.env.DATABASE_URL || ""
  );

  const verificacoesQa: Record<string, boolean> = {
    NODE_ENV:
        process.env.NODE_ENV === "test",

    DATABASE_HOST:
        banco.hostname === "127.0.0.1",

    DATABASE_PORT:
        banco.port === "5433",

    DATABASE_NAME:
        banco.pathname === "/footera_billing_qa",

    CHAT_AUDIO_ATIVO:
        process.env.ENABLE_CHAT_AUDIO === "true",

    CHAT_AUDIO_LOCAL_ATIVO:
        process.env.ENABLE_CHAT_AUDIO_LOCAL === "true",

    CHAT_AUDIO_WORKER_DESATIVADO:
        process.env.ENABLE_CHAT_AUDIO_WORKER === "false",

    AWS_AUDIO_BUCKET_AUSENTE:
        !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim(),

    ACCOUNT_PURGE_DESATIVADO:
        process.env.ENABLE_ACCOUNT_PURGE === "false",

    BILLING_SCHEDULER_DESATIVADO:
        process.env.ENABLE_BILLING_SCHEDULER === "false",

    MP_SCHEDULER_DESATIVADO:
        process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false",
    };

    const verificacoesComErro = Object.entries(
    verificacoesQa
    )
    .filter(([, aprovado]) => !aprovado)
    .map(([nome]) => nome);

    if (verificacoesComErro.length > 0) {
    console.error(
        "[CHAT_AUDIO_QA] Configurações incorretas:",
        verificacoesComErro
    );

    throw new Error("CHAT_AUDIO_QA_ENV_INVALID");
    }

  const arquivo = process.env.CHAT_AUDIO_TEST_FILE;

  if (!arquivo) {
    throw new Error("CHAT_AUDIO_TEST_FILE_MISSING");
  }

  const bytes = await readFile(arquivo);

  let chaveCriada: string | null = null;

  try {
    const audio = await gravarChatAudio(
      "privadas",
      bytes,
      "audio/mp4"
    );

    chaveCriada = audio.key;

    const armazenado = await lerChatAudio(audio.key);

    if (!armazenado.equals(bytes)) {
      throw new Error("AUDIO_ARMAZENADO_DIFERENTE");
    }

    console.log(
      "APROVADO 1 — Gravação e leitura local"
    );

    const [privado, grupo] = await Promise.all([
      prisma.mensagem.findFirst({
        where: { audioKey: audio.key },
        select: { id: true },
      }),
      prisma.mensagemGrupo.findFirst({
        where: { audioKey: audio.key },
        select: { id: true },
      }),
    ]);

    if (privado || grupo) {
      throw new Error("AUDIO_TESTE_INESPERADAMENTE_VINCULADO");
    }

    await prisma.exclusaoAudioMensagemPendente.create({
      data: {
        audioKey: audio.key,
      },
    });

    console.log(
      "APROVADO 2 — Pendência de exclusão registrada"
    );

    const [primeira, segunda] = await Promise.all([
      recuperarExclusoesChatAudio(1, audio.key),
      recuperarExclusoesChatAudio(1, audio.key),
    ]);

    if (
      primeira.processados + segunda.processados !== 1
    ) {
      throw new Error(
        "CONCORRENCIA_RESERVOU_QUANTIDADE_INCORRETA"
      );
    }

    console.log(
      "APROVADO 3 — Apenas um worker reservou o áudio"
    );

    const pendencia =
      await prisma.exclusaoAudioMensagemPendente.findUnique({
        where: {
          audioKey: audio.key,
        },
      });

    if (pendencia) {
      throw new Error("PENDENCIA_NAO_REMOVIDA");
    }

    console.log(
      "APROVADO 4 — Pendência removida do banco"
    );

    let arquivoRemovido = false;

    try {
      await lerChatAudio(audio.key);
    } catch (erro) {
      if (
        (erro as NodeJS.ErrnoException)?.code === "ENOENT"
      ) {
        arquivoRemovido = true;
      } else {
        throw erro;
      }
    }

    if (!arquivoRemovido) {
      throw new Error("ARQUIVO_AINDA_EXISTE");
    }

    console.log(
      "APROVADO 5 — Arquivo físico excluído"
    );

    console.log(
      "CHAT_AUDIO_EXCLUSAO_QA_OK — 5/5"
    );
  } finally {
    if (chaveCriada) {
      const chave = chaveCriada;

      // Limpa apenas o arquivo criado por este teste.
      await removerChatAudio(chave).catch((erro) => {
        console.error(
          "Falha na limpeza final do áudio QA:",
          erro
        );
      });

      await prisma.exclusaoAudioMensagemPendente.deleteMany({
        where: {
          audioKey: chave,
        },
      });
    }

    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});