
import { readFile } from "node:fs/promises";

const API = (
  process.env.CHAT_AUDIO_TEST_API ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

function obrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`FALTA_${nome}`);
  return valor;
}

async function main() {
  const banco = new URL(obrigatorio("DATABASE_URL"));

  if (
    process.env.NODE_ENV !== "test" ||
    banco.hostname !== "127.0.0.1" ||
    banco.port !== "5433" ||
    banco.pathname !== "/footera_billing_qa" ||
    process.env.ENABLE_CHAT_AUDIO_LOCAL !== "true" ||
    process.env.ENABLE_CHAT_AUDIO_WORKER !== "false" ||
    Boolean(process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim())
  ) {
    throw new Error("CHAT_AUDIO_HTTP_QA_ENV_INVALID");
  }

  const tokenA = obrigatorio("CHAT_AUDIO_TOKEN_A");
  const tokenB = obrigatorio("CHAT_AUDIO_TOKEN_B");
  const tokenC = obrigatorio("CHAT_AUDIO_TOKEN_C");
  const usuarioB = obrigatorio("CHAT_AUDIO_USUARIO_B_ID");
  const arquivo = obrigatorio("CHAT_AUDIO_TEST_FILE");

  const bytes = await readFile(arquivo);

  async function requisitar(
    rota: string,
    token?: string,
    opcoes: RequestInit = {}
  ) {
    return fetch(`${API}${rota}`, {
      ...opcoes,
      headers: {
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(opcoes.headers || {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  }

  async function conferirStatus(
    resposta: Response,
    esperado: number,
    teste: string
  ) {
    if (resposta.status !== esperado) {
      const corpo = await resposta.text().catch(() => "");
      throw new Error(
        `${teste}: esperado ${esperado}, recebido ` +
        `${resposta.status}: ${corpo.slice(0, 300)}`
      );
    }
    console.log(`APROVADO: ${teste}`);
  }

  function formularioAudio(destinatario?: string) {
    const form = new FormData();

    form.append(
      "audio",
      new Blob([new Uint8Array(bytes)], {
        type: "audio/mp4",
      }),
      "teste-footera.m4a"
    );

    form.append("audioDuracaoMs", "3000");

    if (destinatario) {
      form.append("paraId", destinatario);
    }

    return form;
  }

  // Teste privado A -> B
  const envio = await requisitar(
    "/api/mensagem/audio",
    tokenA,
    {
      method: "POST",
      body: formularioAudio(usuarioB),
    }
  );

  if (!envio.ok) {
    throw new Error(
      `ENVIO_PRIVADO_FALHOU_${envio.status}_` +
      (await envio.text()).slice(0, 300)
    );
  }

  const mensagem = await envio.json();

  if (
    !mensagem.id ||
    mensagem.tipo !== "AUDIO" ||
    !mensagem.audioKey
  ) {
    throw new Error("RESPOSTA_AUDIO_PRIVADO_INVALIDA");
  }

  console.log("APROVADO: Envio privado A -> B");

  const rotaPrivada =
    `/api/mensagem/audio/${encodeURIComponent(mensagem.id)}`;

  await conferirStatus(
    await requisitar(rotaPrivada, tokenA),
    200,
    "Remetente consegue baixar"
  );

  const respostaB = await requisitar(
    rotaPrivada,
    tokenB
  );

  await conferirStatus(
    respostaB,
    200,
    "Destinatario consegue baixar"
  );

  const recebidoB = Buffer.from(
    await respostaB.arrayBuffer()
  );

  if (!recebidoB.equals(bytes)) {
    throw new Error("AUDIO_RECEBIDO_DIFERENTE_DO_ENVIADO");
  }

  console.log("APROVADO: Bytes preservados");

  await conferirStatus(
    await requisitar(rotaPrivada, tokenC),
    404,
    "Terceiro usuario bloqueado"
  );

  await conferirStatus(
    await requisitar(rotaPrivada),
    401,
    "Usuario sem login bloqueado"
  );

  // Teste de grupo, quando informado
  const grupoId = process.env.CHAT_AUDIO_GRUPO_ID?.trim();

  if (grupoId) {
    const rotaGrupo =
      `/api/mensagem/grupos/${encodeURIComponent(grupoId)}/audio`;

    const envioGrupo = await requisitar(
      rotaGrupo,
      tokenA,
      {
        method: "POST",
        body: formularioAudio(),
      }
    );

    if (!envioGrupo.ok) {
      throw new Error(
        `ENVIO_GRUPO_FALHOU_${envioGrupo.status}_` +
        (await envioGrupo.text()).slice(0, 300)
      );
    }

    const mensagemGrupo = await envioGrupo.json();

    if (
      !mensagemGrupo.id ||
      mensagemGrupo.tipo !== "AUDIO"
    ) {
      throw new Error("RESPOSTA_AUDIO_GRUPO_INVALIDA");
    }

    console.log("APROVADO: Envio de audio no grupo");

    const rotaDownloadGrupo =
      `${rotaGrupo}/${encodeURIComponent(mensagemGrupo.id)}`;

    await conferirStatus(
      await requisitar(rotaDownloadGrupo, tokenB),
      200,
      "Membro do grupo consegue baixar"
    );

    await conferirStatus(
      await requisitar(rotaDownloadGrupo, tokenC),
      404,
      "Nao membro bloqueado"
    );
  } else {
    console.log(
      "TESTE_GRUPO_NAO_EXECUTADO: CHAT_AUDIO_GRUPO_ID ausente"
    );
  }

  console.log("CHAT_AUDIO_HTTP_QA_OK");
  console.log(
    "IMPORTANTE: mensagens de teste foram criadas no QA; " +
    "exclua-as pela interface depois da verificacao."
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});