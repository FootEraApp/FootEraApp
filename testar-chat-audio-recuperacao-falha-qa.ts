
import { randomUUID } from "node:crypto";
import { mkdir, rmdir, stat } from "node:fs/promises";
import path from "node:path";

import { prisma } from "./server/prisma.js";
import {
  recuperarExclusoesChatAudio,
} from "./server/services/chatAudioExclusaoService.js";

function exigir(
  condicao: unknown,
  descricao: string
): asserts condicao {
  if (!condicao) {
    throw new Error(`FALHOU: ${descricao}`);
  }

  console.log(`APROVADO: ${descricao}`);
}

function validarQa() {
  const banco = new URL(
    process.env.DATABASE_URL || ""
  );

  exigir(
    process.env.NODE_ENV === "test" &&
      banco.protocol === "postgresql:" &&
      banco.hostname === "127.0.0.1" &&
      banco.port === "5433" &&
      banco.pathname === "/footera_billing_qa" &&
      process.env.ENABLE_CHAT_AUDIO === "true" &&
      process.env.ENABLE_CHAT_AUDIO_LOCAL === "true" &&
      process.env.ENABLE_CHAT_AUDIO_WORKER === "false" &&
      process.env.ENABLE_ACCOUNT_PURGE === "false" &&
      process.env.ENABLE_BILLING_SCHEDULER === "false" &&
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false" &&
      !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim(),
    "Banco QA e armazenamento local"
  );
}

async function main() {
  validarQa();

  const uuid = randomUUID();

  const audioKey =
    `mensagens-audio/privadas/${uuid}.webm`;

  const pasta = path.join(
    process.cwd(),
    ".footera-chat-audio-local",
    "mensagens-audio",
    "privadas",
    `${uuid}.webm`
  );

  let criouPasta = false;
  let criouPendencia = false;
  let recuperacaoAprovada = false;

  await prisma.$connect();

  try {
    // Criamos uma PASTA com nome de arquivo .webm.
    // O unlink usado pelo storage não consegue
    // remover uma pasta: isso simula falha de I/O.
    await mkdir(pasta, {
      recursive: false,
    });

    criouPasta = true;

    const info = await stat(pasta);

    exigir(
      info.isDirectory(),
      "Falha física simulada com pasta temporária"
    );

    await prisma.exclusaoAudioMensagemPendente.create({
      data: {
        audioKey,
      },
    });

    criouPendencia = true;

    const primeira =
      await recuperarExclusoesChatAudio(
        1,
        audioKey
      );

    console.log(
      "PRIMEIRA_TENTATIVA:",
      primeira
    );

    exigir(
      primeira.processados === 1 &&
        primeira.falhas === 1 &&
        primeira.removidos === 0,
      "Falha registrada sem remover pendência"
    );

    const pendencia =
      await prisma.exclusaoAudioMensagemPendente.findUnique({
        where: {
          audioKey,
        },
      });

    exigir(
      Boolean(
        pendencia &&
        pendencia.tentativas >= 1 &&
        pendencia.ultimoErro &&
        pendencia.proximaTentativaEm > new Date() &&
        pendencia.reservadoPor === null &&
        pendencia.reservadoAte === null
      ),
      "Tentativa, erro e reagendamento preservados"
    );

    // A falha foi resolvida: removemos somente
    // a pasta temporária criada por este teste.
    await rmdir(pasta);
    criouPasta = false;

    // Antecipamos a próxima tentativa
    // somente para a chave exclusiva do teste.
    await prisma.exclusaoAudioMensagemPendente.update({
      where: {
        audioKey,
      },
      data: {
        proximaTentativaEm: new Date(
          Date.now() - 1000
        ),
      },
    });

    const segunda =
      await recuperarExclusoesChatAudio(
        1,
        audioKey
      );

    console.log(
      "SEGUNDA_TENTATIVA:",
      segunda
    );

    exigir(
      segunda.processados === 1 &&
        segunda.removidos === 1 &&
        segunda.falhas === 0,
      "Recuperação removeu pendência"
    );

    const restante =
      await prisma.exclusaoAudioMensagemPendente.findUnique({
        where: {
          audioKey,
        },
      });

    exigir(
      restante === null,
      "Fila limpa após recuperação"
    );

    recuperacaoAprovada = true;

    console.log(
      "CHAT_AUDIO_RECUPERACAO_FALHA_QA_OK"
    );
  } finally {
    if (criouPasta) {
      await rmdir(pasta).catch((erro) => {
        console.error(
          "LIMPEZA_PASTA_QA_FALHOU:",
          erro
        );
      });
    }

    // Se houve falha de teste, preserva a pendência
    // para investigação, em vez de apagá-la
    // silenciosamente.
    if (!recuperacaoAprovada && criouPendencia) {
      console.warn(
        "ATENCAO: conferir pendencia QA:",
        audioKey
      );
    }

    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(
    "CHAT_AUDIO_RECUPERACAO_FALHA_QA_FALHOU",
    erro
  );

  process.exitCode = 1;
});
