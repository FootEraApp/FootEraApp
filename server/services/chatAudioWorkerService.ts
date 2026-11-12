import { chatAudioDisponivel } from "./chatAudioStorage.js";
import { recuperarExclusoesChatAudio } from "./chatAudioExclusaoService.js";

let iniciado = false;
let executando = false;

export async function executarLimpezaChatAudioUmaVez() {
  if (!chatAudioDisponivel()) {
    return {
      processados: 0,
      removidos: 0,
      falhas: 0,
      vinculados: 0,
    };
  }

  if (executando) {
    return {
      processados: 0,
      removidos: 0,
      falhas: 0,
      vinculados: 0,
    };
  }

  executando = true;

  try {
    return await recuperarExclusoesChatAudio(20);
  } finally {
    executando = false;
  }
}

export function iniciarWorkerChatAudio() {
  if (iniciado) return;

  if (process.env.ENABLE_CHAT_AUDIO_WORKER !== "true") {
    return;
  }

  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NODE_ENV !== "development"
  ) {
    return;
  }

  if (!chatAudioDisponivel()) {
    console.warn(
      "[chat-audio] Worker não iniciado: armazenamento indisponível."
    );
    return;
  }

  iniciado = true;

  void executarLimpezaChatAudioUmaVez().catch(
    (erro) => {
        console.error(
        "[chat-audio] Falha na limpeza inicial:",
        erro
        );
    }
  );

  const intervaloMs = 5 * 60_000;

  const timer = setInterval(() => {
    void executarLimpezaChatAudioUmaVez().catch(
      (erro) => {
        console.error(
          "[chat-audio] Falha na limpeza:",
          erro
        );
      }
    );
  }, intervaloMs);

  timer.unref();

  console.log(
    "[chat-audio] Worker de exclusão iniciado."
  );
}