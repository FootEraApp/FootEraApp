
import { prisma } from "./server/prisma.js";
import { recuperarExclusoesChatAudio } from "./server/services/chatAudioExclusaoService.js";
import { lerChatAudio } from "./server/services/chatAudioStorage.js";

function validarQa() {
  const banco = new URL(process.env.DATABASE_URL || "");

  const valido =
    process.env.NODE_ENV === "test" &&
    banco.hostname === "127.0.0.1" &&
    banco.port === "5433" &&
    banco.pathname === "/footera_billing_qa" &&
    process.env.ENABLE_CHAT_AUDIO === "true" &&
    process.env.ENABLE_CHAT_AUDIO_LOCAL === "true" &&
    process.env.ENABLE_CHAT_AUDIO_WORKER === "false" &&
    process.env.ENABLE_ACCOUNT_PURGE === "false" &&
    process.env.ENABLE_BILLING_SCHEDULER === "false" &&
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false" &&
    !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim();

  if (!valido) {
    throw new Error("CHAT_AUDIO_QA_ENV_INVALID");
  }
}

async function main() {
  validarQa();

  const pendencias =
    await prisma.exclusaoAudioMensagemPendente.findMany({
      orderBy: {
        criadoEm: "asc",
      },
      select: {
        audioKey: true,
        tentativas: true,
        proximaTentativaEm: true,
      },
    });

  console.log("PENDENCIAS_QA:", pendencias);

  const chave = process.env.CHAT_AUDIO_QA_PROCESSAR_KEY?.trim();

  if (!chave) {
    console.log(
      "MODO_CONSULTA: nenhuma exclusao executada."
    );
    return;
  }

  const pendencia = pendencias.find(
    (item) => item.audioKey === chave
  );

  if (!pendencia) {
    throw new Error("AUDIO_NAO_ESTA_NA_FILA_QA");
  }

  const [privada, grupo] = await Promise.all([
    prisma.mensagem.findFirst({
      where: { audioKey: chave },
      select: { id: true },
    }),
    prisma.mensagemGrupo.findFirst({
      where: { audioKey: chave },
      select: { id: true },
    }),
  ]);

  if (privada || grupo) {
    throw new Error(
      "AUDIO_AINDA_VINCULADO_A_MENSAGEM_NAO_EXCLUIR"
    );
  }

  if (
    pendencia.proximaTentativaEm.getTime() >
    Date.now()
  ) {
    throw new Error(
      "PENDENCIA_AINDA_NAO_ELEGIVEL_PARA_PROCESSAMENTO"
    );
  }

  const resultado = await recuperarExclusoesChatAudio(
    1,
    chave
  );

  console.log("RESULTADO_WORKER:", resultado);

  const restante =
    await prisma.exclusaoAudioMensagemPendente.findUnique({
      where: {
        audioKey: chave,
      },
    });

  if (
    restante ||
    resultado.removidos !== 1 ||
    resultado.falhas !== 0
  ) {
    throw new Error(
      "EXCLUSAO_NAO_CONCLUIDA"
    );
  }

  try {
    await lerChatAudio(chave);
    throw new Error(
      "FALHOU_ARQUIVO_AINDA_ACESSIVEL"
    );
  } catch (erro) {
    if (
      erro instanceof Error &&
      erro.message === "FALHOU_ARQUIVO_AINDA_ACESSIVEL"
    ) {
      throw erro;
    }

    const mensagem =
      erro instanceof Error ? erro.message : String(erro);

    if (
      !mensagem.includes("ENOENT") &&
      !mensagem.includes("CHAT_AUDIO_NOT_FOUND")
    ) {
      throw erro;
    }
  }

  console.log(
    "CHAT_AUDIO_EXCLUSAO_FISICA_QA_OK"
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });