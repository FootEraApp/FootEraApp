import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config(); 

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || "sa-east-1",
});

const s3 = new AWS.S3();

export const s3Service = {
  async uploadFileAsync(file: Express.Multer.File, folder: string): Promise<string> {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `${folder}/${Date.now()}_${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read", 
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  },
};