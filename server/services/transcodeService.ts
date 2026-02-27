import ffmpeg from "fluent-ffmpeg";
import { uploadToS3 } from "./s3Service.js";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

async function safeUnlink(p: string) {
  try {
    if (p && fs.existsSync(p)) await fs.promises.unlink(p);
  } catch {}
}

function shouldUseS3() {
  const use = String(process.env.USE_S3 || "").trim().toLowerCase();
  const enabled = use === "true" || use === "1" || use === "yes";

  if (!enabled) return false;

  const key = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secret = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "").trim();

  return !!key && !!secret && !!bucket;
}

/**
 * Nunca joga erro pro caller por causa de S3.
 * Se ffmpeg falhar, também não derruba o fluxo: retorna nulls.
 */
export async function transcodeTo720p(midiaId: string, localPath: string) {
  const parsed = path.parse(localPath);
  const outPath = path.join(parsed.dir, `${parsed.name}_720p.mp4`);
  const thumbPath = path.join(parsed.dir, `${parsed.name}_thumb.jpg`);

  let processedUrl: string | null = null;
  let thumbUrl: string | null = null;

  // 1) Transcode + thumb (se der erro, segue com null)
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(localPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .size("?x720")
        .fps(30)
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    await fs.promises.mkdir(path.dirname(thumbPath), { recursive: true });
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(localPath)
          .screenshots({
            timestamps: [1],
            filename: path.basename(thumbPath),
            folder: path.dirname(thumbPath),
            size: "640x?",
          })
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });
    } catch (e) {
      console.warn("[thumb] Falha ao gerar thumb:", e);
    }
  } catch (e) {
    console.warn("[transcode] Falha no ffmpeg (seguindo sem S3):", (e as any)?.message || e);
    // não derruba o fluxo
  }

  // 2) Upload S3 (se habilitado)
  if (shouldUseS3()) {
    try {
      if (fs.existsSync(outPath)) {
        processedUrl = await uploadToS3(outPath, "video/mp4", "videos");
      }
    } catch (e: any) {
      console.warn("[S3] Falha ao subir vídeo processado:", e?.message || e);
      processedUrl = null;
    }

    try {
      if (fs.existsSync(thumbPath)) {
        thumbUrl = await uploadToS3(thumbPath, "image/jpeg", "posters");
      }
    } catch (e: any) {
      console.warn("[S3] Falha ao subir thumb:", e?.message || e);
      thumbUrl = null;
    }
  }

  // 3) Atualiza Midia (não trava)
  try {
    await prisma.midia.update({
      where: { id: midiaId },
      data: {
        processedUrl,
        thumbUrl,
        storageClass: "HOT",
      },
    });
  } catch (e) {
    console.warn("[midia.update] Falhou ao atualizar midia:", e);
  }

  // (opcional) limpar arquivos gerados
  // await safeUnlink(outPath);
  // await safeUnlink(thumbPath);

  return { processedUrl, thumbUrl };
}

export async function generateVideoThumb(inputPath: string, outputPath: string) {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(1)
      .frames(1)
      .outputOptions(["-vf", "scale=640:-1", "-q:v", "2"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}