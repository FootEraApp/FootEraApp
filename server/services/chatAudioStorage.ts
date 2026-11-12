// server/services/chatAudioStorage.ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const CHAT_AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const CHAT_AUDIO_MAX_MS = 120_000;

export type ChatAudioInfo = {
  key: string;
  mime: "audio/webm" | "audio/mp4" | "audio/ogg";
  bytes: number;
};

const s3 = new S3Client({});
const PREFIX = "mensagens-audio/";
const KEY_RE = /^mensagens-audio\/(?:privadas|grupos)\/[0-9a-f-]{36}\.(?:webm|m4a|ogg)$/i;

function localHabilitado(): boolean {
  return (
    (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    ) &&
    process.env.ENABLE_CHAT_AUDIO_LOCAL === "true" &&
    process.env.ENABLE_CHAT_AUDIO === "true"
  );
}

export function chatAudioDisponivel(): boolean {
  if (process.env.ENABLE_CHAT_AUDIO !== "true") {
    return false;
  }

  if (localHabilitado()) {
    return true;
  }

  const bucketAudio =
    process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim();

  const bucketDocumentos =
    process.env.AWS_S3_PRIVATE_BUCKET?.trim();

  if (!bucketAudio) {
    return false;
  }

  if (
    bucketDocumentos &&
    bucketAudio === bucketDocumentos
  ) {
    console.error(
      "[chat-audio] O bucket de áudio deve ser separado do bucket de documentos."
    );

    return false;
  }

  return true;
}

function bucket(): string {
  if (process.env.ENABLE_CHAT_AUDIO !== "true") {
    throw new Error("CHAT_AUDIO_DISABLED");
  }
  const b = process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim();

  if (!b) {
    throw new Error("CHAT_AUDIO_BUCKET_NOT_CONFIGURED");
  }

  const bucketDocumentos =
    process.env.AWS_S3_PRIVATE_BUCKET?.trim();

  if (
    bucketDocumentos &&
    b === bucketDocumentos
  ) {
    throw new Error(
      "CHAT_AUDIO_BUCKET_MUST_BE_SEPARATE"
    );
  }

  return b;
}

function chaveValida(key: string): string {
  if (!KEY_RE.test(key)) throw new Error("CHAT_AUDIO_INVALID_KEY");
  return key;
}

function localPath(key: string): string {
  return path.join(process.cwd(), ".footera-chat-audio-local", chaveValida(key));
}

export function validarChatAudio(buffer: Buffer, mimeRaw: string): { mime: ChatAudioInfo["mime"]; ext: string } {
  if (!buffer.length || buffer.length > CHAT_AUDIO_MAX_BYTES) {
    throw new Error("CHAT_AUDIO_INVALID_SIZE");
  }
  const mime = mimeRaw.toLowerCase().split(";")[0].trim();
  const webm = mime === "audio/webm" && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const mp4 = mime === "audio/mp4" && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const ogg = mime === "audio/ogg" && buffer.subarray(0, 4).toString("ascii") === "OggS";
  if (!webm && !mp4 && !ogg) throw new Error("CHAT_AUDIO_INVALID_FORMAT");
  if (webm) return { mime: "audio/webm", ext: "webm" };
  if (mp4) return { mime: "audio/mp4", ext: "m4a" };
  return { mime: "audio/ogg", ext: "ogg" };
}

export async function gravarChatAudio(tipo: "privadas" | "grupos", bytes: Buffer, mimeRaw: string): Promise<ChatAudioInfo> {
  if (!chatAudioDisponivel()) throw new Error("CHAT_AUDIO_DISABLED");
  const { mime, ext } = validarChatAudio(bytes, mimeRaw);
  const key = `${PREFIX}${tipo}/${randomUUID()}.${ext}`;
  if (localHabilitado()) {
    const destino = localPath(key);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, bytes, { flag: "wx", mode: 0o600 });
  } else {
    await s3.send(new PutObjectCommand({
      Bucket: bucket(), Key: key, Body: bytes, ContentType: mime,
      ServerSideEncryption: "AES256", CacheControl: "private, no-store",
    }));
  }
  return { key, mime, bytes: bytes.length };
}

export async function lerChatAudio(key: string): Promise<Buffer> {
  chaveValida(key);
  if (!chatAudioDisponivel()) throw new Error("CHAT_AUDIO_DISABLED");
  if (localHabilitado()) {
    const bytes = await readFile(localPath(key));
    if (bytes.length > CHAT_AUDIO_MAX_BYTES) throw new Error("CHAT_AUDIO_INVALID_SIZE");
    return bytes;
  }
  const resposta = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!resposta.Body) throw new Error("CHAT_AUDIO_NOT_FOUND");
  const bytes = Buffer.from(await resposta.Body.transformToByteArray());
  if (!bytes.length || bytes.length > CHAT_AUDIO_MAX_BYTES) throw new Error("CHAT_AUDIO_INVALID_SIZE");
  return bytes;
}

export async function removerChatAudio(key: string): Promise<void> {
  chaveValida(key);
  if (!chatAudioDisponivel()) throw new Error("CHAT_AUDIO_DISABLED");
  if (localHabilitado()) {
    await unlink(localPath(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  } else {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  }
}
