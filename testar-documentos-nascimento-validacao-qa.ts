import assert from "node:assert/strict";

function exigirQA() {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5433");
  assert.equal(url.pathname, "/footera_billing_qa");

  assert.equal(
    process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD,
    "false"
  );
}

exigirQA();

async function main() {
  const {
    validarDocumentoNascimento,
    DOCUMENTO_MAX_BYTES,
  } = await import(
    "./server/services/documentosNascimentoStorage.js"
  );

  let aprovados = 0;

  function ok(
    condicao: unknown,
    mensagem: string
  ) {
    assert.ok(condicao, mensagem);

    console.log(
      `APROVADO ${++aprovados} — ${mensagem}`
    );
  }

  const pdf = Buffer.from(
    "%PDF-1.4\n%%EOF",
    "utf8"
  );

  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0,
    0x00, 0x10, 0x4a, 0x46,
  ]);

  const png = Buffer.from([
    137, 80, 78, 71,
    13, 10, 26, 10,
    0, 0, 0, 0,
  ]);

  ok(
    validarDocumentoNascimento({
      buffer: pdf,
      mimetype: "application/pdf",
    }) === "application/pdf",
    "Assinatura PDF reconhecida"
  );

  ok(
    validarDocumentoNascimento({
      buffer: jpeg,
      mimetype: "image/jpeg",
    }) === "image/jpeg",
    "Assinatura JPEG reconhecida"
  );

  ok(
    validarDocumentoNascimento({
      buffer: png,
      mimetype: "image/png",
    }) === "image/png",
    "Assinatura PNG reconhecida"
  );

  assert.throws(
    () =>
      validarDocumentoNascimento({
        buffer: Buffer.from("arquivo falso"),
        mimetype: "application/pdf",
      }),
    /BIRTH_DOCUMENT_INVALID_TYPE/
  );

  ok(true, "Arquivo com assinatura inválida bloqueado");

  assert.throws(
    () =>
      validarDocumentoNascimento({
        buffer: Buffer.alloc(
          DOCUMENTO_MAX_BYTES + 1
        ),
        mimetype: "application/pdf",
      }),
    /BIRTH_DOCUMENT_INVALID_SIZE/
  );

  ok(true, "Arquivo maior que 5 MB bloqueado");

  assert.throws(
    () =>
      validarDocumentoNascimento({
        buffer: Buffer.alloc(0),
        mimetype: "image/png",
      }),
    /BIRTH_DOCUMENT_INVALID_SIZE/
  );

  ok(true, "Arquivo vazio bloqueado");

  assert.throws(
    () =>
      validarDocumentoNascimento({
        buffer: pdf,
        mimetype: "image/jpeg",
      }),
    /BIRTH_DOCUMENT_INVALID_TYPE/
  );

  ok(true, "MIME incompatível com assinatura bloqueado");

  console.log(
    `\nRESULTADO: ${aprovados}/7 verificações aprovadas.`
  );

  console.log(
    "Nenhum documento foi enviado para AWS."
  );
}

main().catch((erro) => {
  console.error(
    "DOCUMENTOS_VALIDACAO_QA_FALHOU",
    erro
  );

  process.exitCode = 1;
});