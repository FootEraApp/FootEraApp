// server/services/s3Service.ts
import AWS from "aws-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || "sa-east-1",
});

const s3 = new AWS.S3();

function getBucketName() {
  const bucket =
    process.env.AWS_S3_BUCKET ||
    process.env.AWS_BUCKET_NAME; 
  if (!bucket) {
    throw new Error(
      "Bucket S3 não configurado. Defina AWS_S3_BUCKET (ou AWS_BUCKET_NAME) no .env."
    );
  }
  return bucket;
}

export const s3Service = {
  async uploadFileAsync(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${Date.now()}_${file.originalname}`;

    const params = {
      Bucket: getBucketName(),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  },
};

export async function uploadToS3(
  filePath: string,
  contentType: string,
  folder = "uploads"
): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  const key = `${folder}/${Date.now()}_${path.basename(filePath)}`;

  const params = {
    Bucket: getBucketName(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  };

  const result = await s3.upload(params).promise();
  return result.Location;
}