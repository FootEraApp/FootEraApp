
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";

function verificarQA() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5433");
  assert.equal(url.pathname, "/footera_billing_qa");

  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, "false");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,
    "false"
  );

  const privado = process.env.AWS_S3_PRIVATE_BUCKET?.trim();

  assert.ok(privado, "AWS_S3_PRIVATE_BUCKET_NAO_CONFIGURADO");

  assert.notEqual(privado, process.env.AWS_S3_BUCKET);
  assert.notEqual(privado, process.env.AWS_BUCKET_NAME);

  // Proteção adicional para não usar acidentalmente
  // o mesmo bucket configurado para produção.
  assert.equal(
    process.env.CONFIRMAR_BUCKET_DOCUMENTOS_QA,
    privado,
    "CONFIRMACAO_EXPLICITA_BUCKET_QA_NECESSARIA"
  );
}

verificarQA();

async function main() {
  const {
    gravarDocumentoNascimento,
    lerDocumentoNascimento,
    removerDocumentoNascimento,
  } = await import(
    "./server/services/documentosNascimentoStorage.js"
  );

  const solicitacaoId = randomUUID();

  // Arquivo PDF sintético. Não contém dados pessoais.
  const arquivo = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog >>\nendobj\n" +
    "%%EOF\n",
    "utf8"
  );

  let chave: string | null = null;

  try {
    const salvo = await gravarDocumentoNascimento(
      solicitacaoId,
      {
        buffer: arquivo,
        mimetype: "application/pdf",
      }
    );

    chave = salvo.s3Key;

    assert.ok(
      chave.startsWith(
        `documentos-nascimento/${solicitacaoId}/`
      )
    );

    console.log("APROVADO 01 — Upload S3 privado");

    assert.equal(salvo.mimeType, "application/pdf");
    assert.equal(salvo.tamanhoBytes, arquivo.length);

    console.log("APROVADO 02 — Metadados corretos");

    const lido = await lerDocumentoNascimento(chave);

    assert.ok(lido.equals(arquivo));

    console.log("APROVADO 03 — Download íntegro");

    const hash = createHash("sha256")
      .update(lido)
      .digest("hex");

    assert.equal(hash, salvo.sha256);

    console.log("APROVADO 04 — SHA-256 confirmado");

    await removerDocumentoNascimento(chave);
    chave = null;

    console.log("APROVADO 05 — Exclusão S3 executada");

    console.log(
      "\nRESULTADO: 5/5 verificações S3 aprovadas."
    );
  } finally {
    if (chave) {
      try {
        await removerDocumentoNascimento(chave);
        console.log("LIMPEZA_QA: objeto de teste removido.");
      } catch (erro) {
        console.error(
          "LIMPEZA_QA_FALHOU: conferir objeto",
          chave,
          erro
        );

        process.exitCode = 1;
      }
    }
  }
}

main().catch((erro) => {
  console.error("DOCUMENTOS_NASCIMENTO_S3_QA_FALHOU", erro);
  process.exitCode = 1;
});