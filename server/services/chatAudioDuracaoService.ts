
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffprobeStatic from "ffprobe-static";

import {
  CHAT_AUDIO_MAX_BYTES,
  CHAT_AUDIO_MAX_MS,
  validarChatAudio,
} from "./chatAudioStorage.js";

const execFileAsync = promisify(execFile);

export async function verificarDuracaoRealChatAudio(
  buffer: Buffer,
  mimeRaw: string
): Promise<number> {
  if (
    buffer.length === 0 ||
    buffer.length > CHAT_AUDIO_MAX_BYTES
  ) {
    throw new Error("CHAT_AUDIO_INVALID_SIZE");
  }

  const { ext } = validarChatAudio(buffer, mimeRaw);

  const executavel = ffprobeStatic.path;

  if (!executavel) {
    throw new Error("CHAT_AUDIO_FFPROBE_UNAVAILABLE");
  }

  const diretorio = await mkdtemp(
    path.join(tmpdir(), "footera-audio-")
  );

  const arquivo = path.join(
    diretorio,
    `${randomUUID()}.${ext}`
  );

  try {
    await writeFile(arquivo, buffer, {
      flag: "wx",
      mode: 0o600,
    });

    let stdout: string;

    try {
      const resultado = await execFileAsync(
        executavel,
        [
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_type:format=duration",
            "-of",
            "json",
            arquivo,
            ],
        {
          timeout: 10_000,
          maxBuffer: 64 * 1024,
          windowsHide: true,
        }
      );

      stdout = resultado.stdout;
    } catch {
      throw new Error("CHAT_AUDIO_INVALID_MEDIA");
    }

    let informacoes: {
    streams?: Array<{
        codec_type?: string;
    }>;
    format?: {
        duration?: string;
    };
    };

    try {
    informacoes = JSON.parse(stdout);
    } catch {
    throw new Error("CHAT_AUDIO_INVALID_MEDIA");
    }

    const temTrilhaAudio =
    Array.isArray(informacoes.streams) &&
    informacoes.streams.some(
        (stream) => stream.codec_type === "audio"
    );

    if (!temTrilhaAudio) {
    throw new Error("CHAT_AUDIO_NO_AUDIO_STREAM");
    }

    let duracaoSegundos = Number(
    informacoes.format?.duration
    );

    if (
    !Number.isFinite(duracaoSegundos) ||
    duracaoSegundos <= 0
    ) {
    let pacotes: string;

    try {
        const resultadoPacotes = await execFileAsync(
        executavel,
        [
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "packet=pts_time,duration_time",
            "-of",
            "compact=p=0:nk=0",
            arquivo,
        ],
        {
            timeout: 15_000,
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true,
        }
        );

        pacotes = resultadoPacotes.stdout;
    } catch {
        throw new Error("CHAT_AUDIO_INVALID_MEDIA");
    }

    let primeiroInicio = Number.POSITIVE_INFINITY;
    let ultimoFim = Number.NEGATIVE_INFINITY;

    for (const linha of pacotes.split(/\r?\n/)) {
        if (!linha.trim()) continue;

        const campos = Object.fromEntries(
        linha.split("|").map((campo) => {
            const indice = campo.indexOf("=");

            return indice >= 0
            ? [
                campo.slice(0, indice),
                campo.slice(indice + 1),
                ]
            : [campo, ""];
        })
        );

        const inicio = Number(campos.pts_time);
        const duracao = Number(campos.duration_time);

        if (
        !Number.isFinite(inicio) ||
        !Number.isFinite(duracao) ||
        duracao <= 0
        ) {
        continue;
        }

        primeiroInicio = Math.min(
        primeiroInicio,
        inicio
        );

        ultimoFim = Math.max(
        ultimoFim,
        inicio + duracao
        );
    }

    if (
        !Number.isFinite(primeiroInicio) ||
        !Number.isFinite(ultimoFim) ||
        ultimoFim <= primeiroInicio
    ) {
        throw new Error("CHAT_AUDIO_INVALID_DURATION");
    }

    duracaoSegundos = ultimoFim - primeiroInicio;
    }

    if (
      !Number.isFinite(duracaoSegundos) ||
      duracaoSegundos <= 0
    ) {
      throw new Error("CHAT_AUDIO_INVALID_DURATION");
    }

    const duracaoMs = Math.round(
      duracaoSegundos * 1000
    );

    if (
      duracaoMs < 700 ||
      duracaoMs > CHAT_AUDIO_MAX_MS
    ) {
      throw new Error("CHAT_AUDIO_DURATION_LIMIT");
    }

    return duracaoMs;
  } finally {
    await rm(diretorio, {
      recursive: true,
      force: true,
    });
  }
}