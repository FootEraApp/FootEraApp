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
import {
  chatAudioS3Disponivel,
  gravarChatAudioS3,
  lerChatAudioS3,
  removerChatAudioS3,
} from "../middlewares/s3Upload.js";

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
  return chatAudioS3Disponivel();
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

export async function gravarChatAudio(
  pasta: "privadas" | "grupos",
  buffer: Buffer,
  mimetype: string
): Promise<{
  key: string;
  mime: string;
  bytes: number;
}> {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new Error("CHAT_AUDIO_FILE_REQUIRED");
  }

  if (buffer.length > CHAT_AUDIO_MAX_BYTES) {
    throw new Error("CHAT_AUDIO_TOO_LARGE");
  }

  return gravarChatAudioS3(
    pasta,
    buffer,
    mimetype
  );
}

export async function lerChatAudio(
  key: string
): Promise<Buffer> {
  return lerChatAudioS3(key);
}

export async function removerChatAudio(
  key: string
): Promise<void> {
  await removerChatAudioS3(key);
}