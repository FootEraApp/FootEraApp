import ffmpeg from "fluent-ffmpeg";
import { uploadToS3 } from "./s3Service.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function transcodeTo720p(midiaId: string, localPath: string) {
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

  const processedUrl = await uploadToS3(outPath, "video/mp4");
  const thumbUrl = await uploadToS3(thumbPath, "image/jpeg");

  await prisma.midia.update({
    where: { id: midiaId },
    data: {
      processedUrl,
      thumbUrl,
      storageClass: "HOT",
    },
  });
}