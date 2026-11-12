
/**
 * FootEra — Teste HTTP de acesso aos áudios.
 *
 * Não cria mensagens.
 * Não exclui registros.
 * Não escreve no banco.
 *
 * A: remetente do áudio privado e membro do grupo.
 * B: destinatário privado e membro do grupo.
 * C: terceiro sem autorização.
 */

const API = (
  process.env.CHAT_AUDIO_TEST_API ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

function exigirVariavel(
  nome: string
): string {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`FALTA_${nome}`);
  }

  return valor;
}

function assegurarQa() {
  const url = new URL(
    exigirVariavel("DATABASE_URL")
  );

  if (
    process.env.NODE_ENV !== "test" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa" ||
    process.env.ENABLE_CHAT_AUDIO_WORKER !== "false"
  ) {
    throw new Error("BANCO_QA_INCORRETO");
  }

  const apiUrl = new URL(API);

  if (
    !["127.0.0.1", "localhost"].includes(
      apiUrl.hostname
    ) ||
    apiUrl.port !== "3001" ||
    apiUrl.protocol !== "http:"
  ) {
    throw new Error(
      "API_NAO_E_LOCALHOST_3001"
    );
  }
}

async function verificar(
  rota: string,
  token: string | undefined,
  esperado: number,
  nome: string
) {
  const response = await fetch(
    `${API}${rota}`,
    {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (response.status !== esperado) {
    throw new Error(
      `FALHOU ${nome}: HTTP ${response.status}, esperado ${esperado}`
    );
  }

  if (esperado === 200) {
    const tipo =
      response.headers.get("content-type") ??
      "";

    const bytes =
      await response.arrayBuffer();

    if (
      !tipo.startsWith("audio/") ||
      bytes.byteLength === 0
    ) {
      throw new Error(
        `FALHOU ${nome}: MIME ou arquivo inválido`
      );
    }
  } else {
    await response.arrayBuffer();
  }

  console.log(
    `APROVADO ${nome}: HTTP ${esperado}`
  );
}

async function main() {
  assegurarQa();

  const tokenA = exigirVariavel(
    "CHAT_AUDIO_TOKEN_A"
  );

  const tokenB = exigirVariavel(
    "CHAT_AUDIO_TOKEN_B"
  );

  const tokenC = exigirVariavel(
    "CHAT_AUDIO_TOKEN_C"
  );

  const idPrivado = exigirVariavel(
    "CHAT_AUDIO_MENSAGEM_PRIVADA_ID"
  );

  const rotaPrivada =
    `/api/mensagem/audio/${encodeURIComponent(
      idPrivado
    )}`;

  await verificar(
    rotaPrivada,
    tokenA,
    200,
    "DM remetente"
  );

  await verificar(
    rotaPrivada,
    tokenB,
    200,
    "DM destinatário"
  );

  await verificar(
    rotaPrivada,
    tokenC,
    404,
    "DM terceiro bloqueado"
  );

  await verificar(
    rotaPrivada,
    undefined,
    401,
    "DM sem login bloqueado"
  );

  const grupo =
    process.env.CHAT_AUDIO_GRUPO_ID?.trim();

  const msgGrupo =
    process.env.CHAT_AUDIO_MENSAGEM_GRUPO_ID?.trim();

  if (grupo && msgGrupo) {
    const rota =
      `/api/mensagem/grupos/${encodeURIComponent(
        grupo
      )}/audio/${encodeURIComponent(
        msgGrupo
      )}`;

    await verificar(
      rota,
      tokenA,
      200,
      "Grupo membro A"
    );

    await verificar(
      rota,
      tokenB,
      200,
      "Grupo membro B"
    );

    await verificar(
      rota,
      tokenC,
      404,
      "Grupo não membro C bloqueado"
    );

    await verificar(
      rota,
      undefined,
      401,
      "Grupo sem login bloqueado"
    );
  } else {
    console.log(
      "NAO_TESTADO: grupo (faltam CHAT_AUDIO_GRUPO_ID e CHAT_AUDIO_MENSAGEM_GRUPO_ID)"
    );
  }

  console.log(
    "CHAT_AUDIO_HTTP_ACESSO_QA_OK — nenhuma escrita realizada"
  );
}

main().catch((erro) => {
  console.error(
    erro instanceof Error
      ? erro.message
      : String(erro)
  );

  process.exitCode = 1;
});