// server/services/documentosNascimentoStorage.ts

import {
  randomUUID,
  createHash,
} from "node:crypto";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export type TipoDocumentoNascimento =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export const DOCUMENTO_MAX_BYTES = 5 * 1024 * 1024;

const cliente = new S3Client({
  region: process.env.AWS_REGION || "sa-east-1",
});

function obterBucketPrivado(): string {
  const privado = String(
    process.env.AWS_S3_PRIVATE_BUCKET ?? ""
  ).trim();

  const publicos = [
    process.env.AWS_S3_BUCKET,
    process.env.AWS_BUCKET_NAME,
  ]
    .map((valor) => String(valor ?? "").trim())
    .filter(Boolean);

  if (
    !privado ||
    privado === "SEU_BUCKET_PRIVADO_QA" ||
    privado === "nome-do-bucket-privado" ||
    privado === "nome-do-bucket-privado-qa"
  ) {
    throw new Error(
      "BIRTH_PRIVATE_BUCKET_NOT_CONFIGURED"
    );
  }

  if (publicos.includes(privado)) {
    throw new Error(
      "BIRTH_PRIVATE_BUCKET_MUST_BE_SEPARATE"
    );
  }

  if (
    process.env.NODE_ENV === "test" &&
    process.env.CONFIRMAR_BUCKET_DOCUMENTOS_QA !== privado
  ) {
    throw new Error(
      "BIRTH_PRIVATE_BUCKET_QA_NOT_CONFIRMED"
    );
  }

  return privado;
}

/** Adaptador usado somente por testes QA locais. Nunca habilitar em produção. */
export type ArmazenamentoNascimentoQA = {
  gravar: (key: string, bytes: Buffer, mimeType: TipoDocumentoNascimento) => Promise<void>;
  ler: (key: string) => Promise<Buffer>;
  remover: (key: string) => Promise<void>;
};

let armazenamentoQa: ArmazenamentoNascimentoQA | null = null;

function ambienteQaLocal(): boolean {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return process.env.NODE_ENV === "test" &&
      url.hostname === "127.0.0.1" && url.port === "5433" &&
      url.pathname === "/footera_billing_qa" &&
      (process.env.MP_ACCESS_TOKEN ?? "") === "" &&
      process.env.ENABLE_ACCOUNT_PURGE === "false" &&
      process.env.ENABLE_BILLING_SCHEDULER === "false" &&
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false";
  } catch { return false; }
}

/** Injetado por um teste, em processo isolado. null remove o adaptador. */
export function configurarArmazenamentoNascimentoQa(
  implementacao: ArmazenamentoNascimentoQA | null
): void {
  if (!ambienteQaLocal()) {
    throw new Error("BIRTH_DOCUMENT_QA_ENV_INVALID");
  }
  armazenamentoQa = implementacao;
}

export function documentosNascimentoDisponiveis(): boolean {
  // Preserva os testes isolados com armazenamento
  // em memória, sem acessar a AWS.
  if (armazenamentoQa && ambienteQaLocal()) {
    return true;
  }

  if (
    process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD !== "true"
  ) {
    return false;
  }

  // Em produção, não aceitar novos documentos
  // sem o processo responsável pela análise.
  if (process.env.NODE_ENV === "production") {
    if (
      process.env.ENABLE_BIRTH_DOCUMENT_WORKER !== "true" ||
      !process.env.CLAMAV_SOCKET_PATH?.trim()
    ) {
      return false;
    }
  }

  try {
    obterBucketPrivado();
    return true;
  } catch {
    return false;
  }
}

export function validarDocumentoNascimento(file: {
  buffer: Buffer;
  mimetype: string;
}): TipoDocumentoNascimento {
  const buffer = file.buffer;

  if (
    !buffer ||
    buffer.length === 0 ||
    buffer.length > DOCUMENTO_MAX_BYTES
  ) {
    throw new Error("BIRTH_DOCUMENT_INVALID_SIZE");
  }

  const pdf =
    buffer.subarray(0, 5).toString("ascii") ===
    "%PDF-";

  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png = buffer.subarray(0, 8).equals(
    Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10,
    ])
  );

  if (file.mimetype === "application/pdf" && pdf) {
    return "application/pdf";
  }

  if (file.mimetype === "image/jpeg" && jpeg) {
    return "image/jpeg";
  }

  if (file.mimetype === "image/png" && png) {
    return "image/png";
  }

  throw new Error("BIRTH_DOCUMENT_INVALID_TYPE");
}

export async function gravarDocumentoNascimento(
  solicitacaoId: string,
  file: {
    buffer: Buffer;
    mimetype: string;
  }
) {
  const mimeType = validarDocumentoNascimento(file);

  const extensao =
    mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "image/jpeg"
        ? "jpg"
        : "png";

  const s3Key =
    `documentos-nascimento/` +
    `${solicitacaoId}/` +
    `${randomUUID()}.${extensao}`;

  if (armazenamentoQa && ambienteQaLocal()) {
    await armazenamentoQa.gravar(s3Key, Buffer.from(file.buffer), mimeType);
  } else {
    await cliente.send(
      new PutObjectCommand({
      Bucket: obterBucketPrivado(),
      Key: s3Key,
      Body: file.buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
      CacheControl: "no-store",
      })
    );
  }

  return {
    s3Key,
    mimeType,
    tamanhoBytes: file.buffer.length,
    sha256: createHash("sha256")
      .update(file.buffer)
      .digest("hex"),
  };
}

function validarChaveDocumentoNascimento(
  s3Key: string
): void {
  const formato =
    /^documentos-nascimento\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$/i;

  if (!formato.test(s3Key)) {
    throw new Error(
      "BIRTH_DOCUMENT_KEY_INVALID"
    );
  }
}

export async function lerDocumentoNascimento(
  s3Key: string
): Promise<Buffer> {
  validarChaveDocumentoNascimento(s3Key);

  let bytes: Buffer;
  if (armazenamentoQa && ambienteQaLocal()) {
    bytes = Buffer.from(await armazenamentoQa.ler(s3Key));
  } else {
    const objeto = await cliente.send(
      new GetObjectCommand({ Bucket: obterBucketPrivado(), Key: s3Key })
    );
    if (!objeto.Body) throw new Error("BIRTH_DOCUMENT_NOT_FOUND_IN_S3");
    bytes = Buffer.from(await objeto.Body.transformToByteArray());
  }

  if (bytes.length > DOCUMENTO_MAX_BYTES) {
    throw new Error("BIRTH_DOCUMENT_OVERSIZE");
  }

  return bytes;
}

export async function removerDocumentoNascimento(
  s3Key: string
): Promise<void> {
  validarChaveDocumentoNascimento(s3Key);

  if (armazenamentoQa && ambienteQaLocal()) {
    await armazenamentoQa.remover(s3Key);
  } else {
    await cliente.send(
      new DeleteObjectCommand({ Bucket: obterBucketPrivado(), Key: s3Key })
    );
  }
}

export async function listarObjetosNascimentoS3(
  continuationToken?: string
): Promise<{
  objetos: Array<{
    s3Key: string;
    ultimaModificacao: Date | null;
  }>;
  nextToken?: string;
}> {
  // Esta operação é exclusiva do armazenamento real.
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "BIRTH_DOCUMENT_S3_LIST_PRODUCTION_ONLY"
    );
  }

  const resposta = await cliente.send(
    new ListObjectsV2Command({
      Bucket: obterBucketPrivado(),
      Prefix: "documentos-nascimento/",
      MaxKeys: 500,
      ContinuationToken: continuationToken,
    })
  );

  return {
    objetos: (resposta.Contents ?? [])
      .filter((objeto) => Boolean(objeto.Key))
      .map((objeto) => ({
        s3Key: objeto.Key!,
        ultimaModificacao:
          objeto.LastModified ?? null,
      })),
    nextToken: resposta.NextContinuationToken,
  };
}