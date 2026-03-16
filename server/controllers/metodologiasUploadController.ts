import { Request, Response } from "express";

export async function uploadMetodologiaS3(req: Request, res: Response) {
  try {
    const file = req.file as any;

    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado ou formato inválido." });
    }

    return res.status(201).json({
      ok: true,
      url: file.location, // URL pública do S3 gerada pelo multer-s3
      key: file.key,      // Caminho interno (ex: metodologias/videos/123.mp4)
      mimetype: file.mimetype
    });
  } catch (error) {
    console.error("Erro no upload metodologias S3:", error);
    return res.status(500).json({ error: "Erro interno no upload para o S3." });
  }
}