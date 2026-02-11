// server/controllers/metodologiasUploadController
import { Request, Response } from "express";

function fileToUploadsUrl(file: Express.Multer.File) {
  const dest = (file.destination || "").replace(/\\/g, "/");
  const leaf = dest.split("/").filter(Boolean).slice(-2).join("/"); 
  // leaf vira "metodologias/videos" ou "metodologias/capas"
  return `/uploads/${leaf}/${file.filename}`;
}

export async function uploadMetodologiaVideo(req: Request, res: Response) {
  console.log("✅✅ METODOLOGIAS UPLOAD ROUTE (VIDEO) CHEGOU AQUI");
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: "Arquivo 'video' é obrigatório." });

  if (!file.mimetype?.startsWith("video")) {
    return res.status(400).json({ message: "Envie um arquivo de vídeo." });
  }

  const relativeUrl = fileToUploadsUrl(file);
  return res.status(201).json({
    ok: true,
    tipo: "VIDEO",
    relativeUrl,
    url: relativeUrl,
    filename: file.filename,
  });
}

export async function uploadMetodologiaCapa(req: Request, res: Response) {
  console.log("❌❌ UPLOAD GENERICO CHEGOU AQUI");
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: "Arquivo 'capa' é obrigatório." });

  if (!file.mimetype?.startsWith("image")) {
    return res.status(400).json({ message: "Envie uma imagem para a capa." });
  }

  const relativeUrl = fileToUploadsUrl(file);
  return res.status(201).json({
    ok: true,
    tipo: "CAPA",
    relativeUrl,
    url: relativeUrl,
    filename: file.filename,
  });
}
