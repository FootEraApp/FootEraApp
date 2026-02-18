import type { Request, Response } from "express";
import path from "path";
import fs from "fs-extra";
import { execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";

function getFfmpegPath(): string | null {
  const p = ffmpegStatic as unknown as string | null | undefined;
  if (typeof p === "string" && p.trim().length > 0) return p;
  return null;
}

function pickFfmpegCmd() {
  return getFfmpegPath() ?? "ffmpeg"; // fallback se tiver ffmpeg no PATH
}

function fileToUploadsUrl(file: Express.Multer.File) {
  const dest = (file.destination || "").replace(/\\/g, "/");
  const leaf = dest.split("/").filter(Boolean).slice(-2).join("/"); // ex: metodologias/videos
  return `/uploads/${leaf}/${file.filename}`;
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
  });
}

export async function uploadMetodologiaVideo(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: "Arquivo 'video' é obrigatório." });

  if (!file.mimetype?.startsWith("video")) {
    return res.status(400).json({ message: "Envie um arquivo de vídeo." });
  }

  const videoRelativeUrl = fileToUploadsUrl(file);
  const videoAbs = file.path;

  const thumbsDir = path.join(process.cwd(), "uploads", "thumbs", "metodologias");
  await fs.ensureDir(thumbsDir);

  const base = path.parse(file.filename).name;
  const thumbFilename = `${base}.jpg`;
  const thumbAbs = path.join(thumbsDir, thumbFilename);

  try {
    const cmd = pickFfmpegCmd();

    await run(cmd, [
      "-y",
      "-ss", "00:00:01",
      "-i", videoAbs,
      "-frames:v", "1",
      "-q:v", "2",
      thumbAbs,
    ]);

    const thumbRelativeUrl = `/uploads/thumbs/metodologias/${thumbFilename}`;

    return res.status(201).json({
      ok: true,
      tipo: "VIDEO",
      relativeUrl: videoRelativeUrl,
      url: videoRelativeUrl,
      thumbUrl: thumbRelativeUrl,
      thumbRelativeUrl,
      filename: file.filename,
      thumbFilename,
    });
  } catch (e: any) {
    // não trava o fluxo se falhar thumb
    return res.status(201).json({
      ok: true,
      tipo: "VIDEO",
      relativeUrl: videoRelativeUrl,
      url: videoRelativeUrl,
      filename: file.filename,
      warning: "Vídeo salvo, mas não foi possível gerar thumb (ffmpeg).",
      error: e?.message,
    });
  }
}

export async function uploadMetodologiaCapa(req: Request, res: Response) {
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