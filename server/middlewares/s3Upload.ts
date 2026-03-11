// server/middlewares/s3Upload.ts
import { Request } from "express"; // <-- Isso resolve o erro do TypeScript!
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Cria a conexão com a AWS usando as chaves do seu .env
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
    bucket: process.env.AWS_S3_BUCKET!, // Vai pegar o "footera-user-content"
    contentType: multerS3.AUTO_CONTENT_TYPE,
//    acl: "public-read", // Libera o arquivo para ser lido pelo site
    
    // Aqui nós dizemos ao TypeScript exatamente quem é quem:
    key: (req: Request, file: Express.Multer.File, cb: any) => {
      
      // Coloquei o req.body em uma variável para ficar mais limpo
      const body = req.body || {};
      
      // Pega a lógica de nomes do seu código antigo
      const texto = (body.descricao && body.descricao.length ? body.descricao : body.conteudo) || "";
      const isCard = /Meu Card FOOTERA/i.test(texto);
      const isVideo = file.mimetype?.startsWith("video");
      
      const subPasta = isVideo ? "videos" : isCard ? "cards" : "posts";
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : (isVideo ? ".mp4" : ".png");
      
      const fileName = `${Date.now()}${!isVideo && isCard ? "-card" : ""}${ext}`;
      
      // Salva na Amazon dentro da "pasta" correspondente
      cb(null, `${subPasta}/${fileName}`);
    },
  }),
});

export const deleteFromS3 = async (fileUrl: string) => {
  try {
    // A URL no banco é algo como https://bucket.s3.region.amazonaws.com/posts/123.png
    // Precisamos apenas da "Key" (o caminho dentro do bucket: posts/123.png)
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
    // Não lançamos erro aqui para não travar a exclusão do post se o arquivo já não existir
  }
};