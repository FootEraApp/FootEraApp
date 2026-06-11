// server/middlewares/s3Upload.ts
import { Request } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadToS3 = multer({
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