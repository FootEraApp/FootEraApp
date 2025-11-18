import ffmpeg from "fluent-ffmpeg";
import { uploadToS3 } from "./s3Service.js"; // ou o que você já usa
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function transcodeTo720p(midiaId: string, localPath: string) {
  // 1) gerar arquivo 720p/30fps
  const outPath = localPath.replace(/\.(mp4|mov|mkv)$/i, "_720p.mp4");

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

  // 2) gerar thumbnail
  const thumbPath = localPath.replace(/\.(mp4|mov|mkv)$/i, "_thumb.jpg");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(localPath)
      .screenshots({
        timestamps: ["50%"],
        filename: thumbPath.split("/").pop(),
        folder: thumbPath.replace(/\/[^/]+$/, ""),
        size: "640x?",
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });

  // 3) subir para S3 / CloudFront
  const processedUrl = await uploadToS3(outPath, "video/mp4");
  const thumbUrl = await uploadToS3(thumbPath, "image/jpeg");

  // 4) salvar metadados
  await prisma.midia.update({
    where: { id: midiaId },
    data: {
      processedUrl,
      thumbUrl,
      // durationSec: ... (se já pegou na probe),
      storageClass: "HOT",
    },
  });
}