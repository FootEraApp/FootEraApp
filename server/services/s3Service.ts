import { S3 } from "aws-sdk";

const s3 = new S3();

export const s3Service = {
  async uploadFileAsync(file: Express.Multer.File, folder: string): Promise<string> {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `${folder}/${Date.now()}_${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  },
};
