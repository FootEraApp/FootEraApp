import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "./server/prisma.js";
import { lerChatAudio } from "./server/services/chatAudioStorage.js";

const API = (
  process.env.CHAT_AUDIO_TEST_API ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

function obrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`FALTA_${nome}`);
  return valor;
}

function verificarAmbiente() {
  const banco = new URL(obrigatorio("DATABASE_URL"));
  const api = new URL(API);

  const correto =
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
    !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim() &&
    api.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(api.hostname) &&
    api.port === "3001";

  if (!correto) throw new Error("AMBIENTE_QA_INVALIDO");
}

async function requisicao(
  rota: string,
  token: string,
  opcoes: RequestInit = {}
) {
  return fetch(`${API}${rota}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opcoes.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
}

async function status(
  resposta: Response,
  esperado: number,
  descricao: string
) {
  if (resposta.status !== esperado) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(
      `${descricao}: HTTP ${resposta.status}, ` +
      `esperado ${esperado}. ${corpo.slice(0, 250)}`
    );
  }
  console.log(`APROVADO: ${descricao} — HTTP ${esperado}`);
}

function formularioAudio(
  bytes: Buffer,
  destinatarioId?: string
) {
  const form = new FormData();

  form.append(
    "audio",
    new Blob([new Uint8Array(bytes)], {
      type: "audio/mp4",
    }),
    "footera-exclusao-qa.m4a"
  );

  form.append("audioDuracaoMs", "3000");

  if (destinatarioId) {
    form.append("paraId", destinatarioId);
  }

  return form;
}

async function conferirRemocao(
  id: string,
  chave: string,
  grupo: boolean
) {
  const registro = grupo
    ? await prisma.mensagemGrupo.findUnique({
        where: { id },
        select: { id: true },
      })
    : await prisma.mensagem.findUnique({
        where: { id },
        select: { id: true },
      });

  if (registro) {
    throw new Error("MENSAGEM_CONTINUA_NO_BANCO");
  }

  const pendencia =
    await prisma.exclusaoAudioMensagemPendente.findUnique({
      where: { audioKey: chave },
    });

  if (pendencia) {
    // A exclusão do arquivo pode ter falhado.
    // Preservamos a fila para recuperação.
    throw new Error(
      "ARQUIVO_PENDENTE_DE_LIMPEZA_VERIFICAR_FILA"
    );
  }

  let arquivoAusente = false;

  try {
    await lerChatAudio(chave);
  } catch (erro) {
    const codigo =
      (erro as NodeJS.ErrnoException)?.code;
    const mensagem =
      erro instanceof Error ? erro.message : String(erro);

    arquivoAusente =
      codigo === "ENOENT" ||
      mensagem.includes("ENOENT") ||
      mensagem.includes("CHAT_AUDIO_NOT_FOUND");
  }

  if (!arquivoAusente) {
    throw new Error("ARQUIVO_FISICO_NAO_REMOVIDO");
  }

  console.log(
    `APROVADO: Registro e arquivo removidos (${grupo ? "grupo" : "privado"})`
  );
}

async function main() {
  verificarAmbiente();

  const tokenA = obrigatorio("CHAT_AUDIO_TOKEN_A");
  const tokenB = obrigatorio("CHAT_AUDIO_TOKEN_B");
  const tokenC = obrigatorio("CHAT_AUDIO_TOKEN_C");

  const destinatarioId = obrigatorio(
    "CHAT_AUDIO_USUARIO_B_ID"
  );

  const grupoId = process.env.CHAT_AUDIO_GRUPO_ID?.trim();

  const binario = ffmpegPath as string;

  if (!binario) {
    throw new Error("FFMPEG_NAO_ENCONTRADO");
  }

  const caminho = join(
    tmpdir(),
    `footera-exclusao-${randomUUID()}.m4a`
  );

  try {
    execFileSync(binario, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-c:a",
      "aac",
      "-y",
      caminho,
    ]);

    const bytes = await readFile(caminho);

    // PRIVADO
    const envioPrivado = await requisicao(
      "/api/mensagem/audio",
      tokenA,
      {
        method: "POST",
        body: formularioAudio(
          bytes,
          destinatarioId
        ),
      }
    );

    await status(
      envioPrivado,
      200,
      "Envio de audio privado"
    );

    const privado = await envioPrivado.json();

    if (
      privado.tipo !== "AUDIO" ||
      !privado.id ||
      !privado.audioKey
    ) {
      throw new Error("MENSAGEM_PRIVADA_INVALIDA");
    }

    const rotaPrivada =
      `/api/mensagem/audio/${encodeURIComponent(privado.id)}`;

    await status(
      await requisicao(rotaPrivada, tokenB),
      200,
      "Destinatario baixa audio privado"
    );

    await status(
      await requisicao(
        `/api/mensagem/${encodeURIComponent(privado.id)}`,
        tokenC,
        { method: "DELETE" }
      ),
      403,
      "Terceiro nao pode excluir mensagem privada"
    );

    await status(
      await requisicao(
        `/api/mensagem/${encodeURIComponent(privado.id)}`,
        tokenA,
        { method: "DELETE" }
      ),
      204,
      "Remetente exclui mensagem privada"
    );

    await status(
      await requisicao(rotaPrivada, tokenB),
      404,
      "Audio privado excluido nao pode ser baixado"
    );

    await conferirRemocao(
      privado.id,
      privado.audioKey,
      false
    );

    // GRUPO (opcional)
    if (grupoId) {
      const envioGrupo = await requisicao(
        `/api/mensagem/grupos/${encodeURIComponent(grupoId)}/audio`,
        tokenA,
        {
          method: "POST",
          body: formularioAudio(bytes),
        }
      );

      await status(
        envioGrupo,
        201,
        "Envio de audio no grupo"
      );

      const mensagemGrupo =
        await envioGrupo.json();

      if (
        mensagemGrupo.tipo !== "AUDIO" ||
        !mensagemGrupo.id ||
        !mensagemGrupo.audioKey
      ) {
        throw new Error("MENSAGEM_GRUPO_INVALIDA");
      }

      const rotaAudioGrupo =
        `/api/mensagem/grupos/${encodeURIComponent(grupoId)}/audio/${encodeURIComponent(mensagemGrupo.id)}`;

      await status(
        await requisicao(rotaAudioGrupo, tokenB),
        200,
        "Membro baixa audio do grupo"
      );

      await status(
        await requisicao(
          `/api/mensagem/${encodeURIComponent(mensagemGrupo.id)}`,
          tokenC,
          { method: "DELETE" }
        ),
        403,
        "Terceiro nao pode excluir audio do grupo"
      );

      await status(
        await requisicao(
          `/api/mensagem/${encodeURIComponent(mensagemGrupo.id)}`,
          tokenA,
          { method: "DELETE" }
        ),
        204,
        "Remetente exclui audio do grupo"
      );

      await status(
        await requisicao(rotaAudioGrupo, tokenB),
        404,
        "Audio de grupo excluido nao pode ser baixado"
      );

      await conferirRemocao(
        mensagemGrupo.id,
        mensagemGrupo.audioKey,
        true
      );
    } else {
      console.log(
        "NAO_TESTADO: exclusao de audio em grupo"
      );
    }

    console.log("CHAT_AUDIO_EXCLUSAO_HTTP_QA_OK");
  } finally {
    await unlink(caminho).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});