// utils/s3.ts
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Configuração básica do S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
});

// Função para fazer upload
export const uploadFile = async (file: Express.Multer.File, folder: string): Promise<string> => {
  const fileStream = fs.createReadStream(file.path);

  const fileExt = path.extname(file.originalname);
  const filename = `${folder}/${uuidv4()}${fileExt}`;

  const params: AWS.S3.PutObjectRequest = {
    Bucket: process.env.AWS_S3_BUCKET || "",
    Key: filename,
    Body: fileStream,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  await s3.upload(params).promise();

  // URL pública
  return `https://${params.Bucket}.s3.amazonaws.com/${filename}`;
};
