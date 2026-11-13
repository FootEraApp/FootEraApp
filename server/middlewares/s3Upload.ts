// server/middlewares/s3Upload.ts
import { Request } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { randomUUID } from "node:crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3 = multer({
  limits: {
    fileSize: 4 * 1024 * 1024 * 1024, // 4GB
  },
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET!,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req: Request, file: Express.Multer.File, cb: any) => {
      const isVideo = file.mimetype?.startsWith("video");
      const ext = file.originalname 
        ? file.originalname.substring(file.originalname.lastIndexOf('.')) 
        : (isVideo ? ".mp4" : ".png");
      
      const timestamp = Date.now();
      const isMetodologia = req.originalUrl.includes("metodologias");
      const isExercicio = req.originalUrl.includes("exercicios");

      if (isMetodologia) {
        const subPasta = isVideo ? "videos" : "capas";
        return cb(null, `metodologias/${subPasta}/${timestamp}${ext}`);
      }

      if (isExercicio) {
        return cb(null, `exercicios/videos/${timestamp}${ext}`);
      }

      const body = req.body || {};
      const texto = (body.descricao && body.descricao.length ? body.descricao : body.conteudo) || "";
      const isCard = /Meu Card FOOTERA/i.test(texto);      
      const subPastaGeral = isVideo ? "videos" : isCard ? "cards" : "posts";
      const fileName = `${timestamp}${!isVideo && isCard ? "-card" : ""}${ext}`;
      
      cb(null, `${subPastaGeral}/${fileName}`);
    },
  }),
});

export const deleteFromS3 = async (fileUrl: string) => {
  try {
    const urlParts = fileUrl.split(".com/");
    const key = urlParts[1];

    if (!key) return;

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    });

    await s3.send(command);
    console.log(`Arquivo removido do S3: ${key}`);
  } catch (error) {
    console.error("Erro ao deletar arquivo do S3:", error);
  }
};

// Áudios de mensagens usam o mesmo S3 do feed.
// O envio acontece após as validações do controller.

const EXTENSOES_AUDIO: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
};

export function chatAudioS3Disponivel(): boolean {
  // Corresponde à configuração explícita de credenciais
  // utilizada pelo cliente S3 deste arquivo.
  return Boolean(
    process.env.AWS_S3_BUCKET?.trim() &&
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

function obterBucketChatAudio(): string {
  const bucket = process.env.AWS_S3_BUCKET?.trim();

  if (!bucket) {
    throw new Error("CHAT_AUDIO_UNAVAILABLE");
  }

  return bucket;
}

function validarChaveChatAudio(key: string): void {
  // Impede que a função de áudio exclua arquivos do feed
  // ou consulte outros caminhos do bucket.
  if (
    !/^audios\/(privadas|grupos)\/[a-zA-Z0-9._-]+$/.test(key)
  ) {
    throw new Error("CHAT_AUDIO_INVALID_KEY");
  }
}

export async function gravarChatAudioS3(
  pasta: "privadas" | "grupos",
  buffer: Buffer,
  mimetype: string
): Promise<{
  key: string;
  mime: string;
  bytes: number;
}> {
  if (!chatAudioS3Disponivel()) {
    throw new Error("CHAT_AUDIO_UNAVAILABLE");
  }

  if (pasta !== "privadas" && pasta !== "grupos") {
    throw new Error("CHAT_AUDIO_INVALID_FOLDER");
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("CHAT_AUDIO_FILE_REQUIRED");
  }

  // Ex.: audio/webm;codecs=opus -> audio/webm
  const mime = String(mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const extensao = EXTENSOES_AUDIO[mime];

  if (!extensao) {
    throw new Error("CHAT_AUDIO_INVALID_TYPE");
  }

  const key =
    `audios/${pasta}/` +
    `${Date.now()}-${randomUUID()}${extensao}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: obterBucketChatAudio(),
      Key: key,
      Body: buffer,
      ContentType: mime,
      ContentLength: buffer.length,
      CacheControl: "private, no-store",
    })
  );

  return {
    key,
    mime,
    bytes: buffer.length,
  };
}

export async function lerChatAudioS3(
  key: string
): Promise<Buffer> {
  validarChaveChatAudio(key);

  const resultado = await s3.send(
    new GetObjectCommand({
      Bucket: obterBucketChatAudio(),
      Key: key,
    })
  );

  if (!resultado.Body) {
    throw new Error("CHAT_AUDIO_EMPTY_BODY");
  }

  return Buffer.from(
    await resultado.Body.transformToByteArray()
  );
}

export async function removerChatAudioS3(
  key: string
): Promise<void> {
  validarChaveChatAudio(key);

  // Não captura o erro aqui: o controller precisa recebê-lo
  // para manter a exclusão na fila de pendências.
  await s3.send(
    new DeleteObjectCommand({
      Bucket: obterBucketChatAudio(),
      Key: key,
    })
  );
}