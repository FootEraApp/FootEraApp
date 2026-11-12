
import { readFile } from "node:fs/promises";
import {
  verificarDuracaoRealChatAudio,
} from "./server/services/chatAudioDuracaoService.js";

async function deveRejeitar(
  arquivo: string,
  codigoEsperado: string
) {
  const bytes = await readFile(arquivo);

  try {
    await verificarDuracaoRealChatAudio(
      bytes,
      "audio/mp4"
    );
  } catch (erro) {
    const codigo =
      erro instanceof Error
        ? erro.message
        : String(erro);

    if (codigo !== codigoEsperado) {
      throw new Error(
        `ESPERADO_${codigoEsperado}_RECEBIDO_${codigo}`
      );
    }

    console.log(`APROVADO: ${codigoEsperado}`);
    return;
  }

  throw new Error(
    `ARQUIVO_INVALIDO_FOI_ACEITO_${codigoEsperado}`
  );
}

async function main() {
  const longo = process.env.CHAT_AUDIO_TEST_LONGO;
  const semAudio = process.env.CHAT_AUDIO_TEST_SEM_AUDIO;

  if (!longo || !semAudio) {
    throw new Error("ARQUIVOS_TESTE_NAO_CONFIGURADOS");
  }

  await deveRejeitar(
    longo,
    "CHAT_AUDIO_DURATION_LIMIT"
  );

  await deveRejeitar(
    semAudio,
    "CHAT_AUDIO_NO_AUDIO_STREAM"
  );

  console.log("CHAT_AUDIO_MIDIA_QA_OK — 2/2");
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});