/** QA HTTP sem AWS: garante que o guard barra arquivos antes do Multer.
 * Servidor temporario localhost, sem banco e sem credenciais AWS.
 */
import assert from "node:assert/strict";

async function main() {
  assert.equal(process.env.NODE_ENV, "test", "NODE_ENV_DEVE_SER_TEST");
  assert.equal(process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD, "false");

  const { default: express } = await import("express");
  const {
    exigirUploadNascimentoAtivo,
    receberDocumentoNascimento,
  } = await import("./server/controllers/documentosNascimentoController.js");

  const app = express();
  let chegouAoController = false;
  app.post(
    "/api/correcao-nascimento/qa/documento",
    exigirUploadNascimentoAtivo,
    receberDocumentoNascimento,
    (_req, res) => {
      chegouAoController = true;
      res.status(200).json({ ok: true });
    }
  );
  const servidor = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1");
    s.once("error", reject);
    s.once("listening", () => resolve(s));
  });
  let total = 0;
  const ok = (valor: unknown, desc: string) => {
    assert.ok(valor, desc);
    console.log(`APROVADO ${String(++total).padStart(2, "0")} — ${desc}`);
  };

  try {
    const endereco = servidor.address();
    assert.ok(endereco && typeof endereco !== "string");
    const url = `http://127.0.0.1:${endereco.port}/api/correcao-nascimento/qa/documento`;
    let resposta = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
    const corpo = await resposta.json() as { code?: string };
    ok(resposta.status === 503 && corpo.code === "BIRTH_DOCUMENT_UPLOAD_UNAVAILABLE",
      "Upload desativado retorna 503 e codigo correto");
    ok(!chegouAoController, "Controller nao executado com funcionalidade desativada");

    const multipart = new FormData();
    multipart.append("documento", new Blob([new Uint8Array(6 * 1024 * 1024)], {
      type: "application/pdf",
    }), "documento-qa.pdf");
    resposta = await fetch(url, { method: "POST", body: multipart, signal: AbortSignal.timeout(15_000) });
    ok(resposta.status === 503,
      "Arquivo de 6 MB e recusado antes do processamento multipart");
    ok(!chegouAoController, "Upload volumoso nao chegou ao processamento");
    console.log(`\nRESULTADO: ${total}/${total} verificacoes HTTP offline aprovadas.`);
    console.log("NAO COBRE: autenticacao real, S3, malware, download, decisao administrativa.");
  } finally {
    servidor.closeIdleConnections?.();
    await new Promise<void>((resolve, reject) => {
      servidor.close((erro) => erro ? reject(erro) : resolve());
    });
  }
}
main().catch((erro) => {
  console.error("DOCUMENTOS_UPLOAD_DESATIVADO_HTTP_QA_FALHOU:", erro);
  process.exitCode = 1;
});