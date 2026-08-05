// server/controllers/uploadController.ts
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { TipoMidia, StorageClass } from "@prisma/client";
import { probeImage, probeVideo } from "../services/mediaMetadata.js";
import { audit } from "../services/audit.js";
import { uploadError } from "../services/uploadErrors.js";
import { transcodeTo720p, generateVideoThumb } from "../services/transcodeService.js";
import { prisma } from "../prisma.js";

const MAX_VIDEO_SEC = 60;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const thumbsDir = path.join(uploadsDir, "thumbs");
fs.mkdirSync(thumbsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

function baseUrlFromReq(req: Request) {
  const base =
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    process.env.APP_URL ||
    `${req.protocol}://${req.get("host")}`;
  return String(base).replace(/\/+$/, "");
}

async function verificarPosseAlvoUpload(params: {
  isAdminUser: boolean;
  requesterId: string;
  atletaId?: any;
  clubeId?: any;
  escolinhaId?: any;
  exercicioPersonalizadoId?: any;
  submissaoDesafioId?: any;
  submissaoTreinoId?: any;
}): Promise<boolean> {
  if (params.isAdminUser) return true;
  if (!params.requesterId) return false;

  if (params.atletaId) {
    const atleta = await prisma.atleta.findUnique({
      where: { id: String(params.atletaId) },
      select: { usuarioId: true },
    });
    if (!atleta || atleta.usuarioId !== params.requesterId) return false;
  }

  if (params.clubeId) {
    const clube = await prisma.clube.findUnique({
      where: { id: String(params.clubeId) },
      select: { usuarioId: true },
    });
    if (!clube || clube.usuarioId !== params.requesterId) return false;
  }

  if (params.escolinhaId) {
    const escolinha = await prisma.escolinha.findUnique({
      where: { id: String(params.escolinhaId) },
      select: { usuarioId: true },
    });
    if (!escolinha || escolinha.usuarioId !== params.requesterId) return false;
  }

  if (params.exercicioPersonalizadoId) {
    const exercicio = await prisma.exercicioPersonalizado.findUnique({
      where: { id: String(params.exercicioPersonalizadoId) },
      select: { criadorUsuarioId: true },
    });
    if (!exercicio || exercicio.criadorUsuarioId !== params.requesterId) return false;
  }

  if (params.submissaoDesafioId) {
    const submissao = await prisma.submissaoDesafio.findUnique({
      where: { id: String(params.submissaoDesafioId) },
      select: { usuarioId: true },
    });
    if (!submissao || submissao.usuarioId !== params.requesterId) return false;
  }

  if (params.submissaoTreinoId) {
    const submissao = await prisma.submissaoTreino.findUnique({
      where: { id: String(params.submissaoTreinoId) },
      select: { usuarioId: true },
    });
    if (!submissao || submissao.usuarioId !== params.requesterId) return false;
  }

  return true;
}

export const uploadMidia = [
  upload.fields([
    { name: "foto", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    let localPathToCleanup: string | null = null;
    let out720pToCleanup: string | null = null;
    let thumbToCleanup: string | null = null;

    try {
      const filesAny = req.files as any;
      const file: Express.Multer.File | null =
        filesAny?.foto?.[0] || filesAny?.file?.[0] || null;

      if (!file) {
        return res
          .status(400)
          .json(uploadError("FILE_REQUIRED", "Envie um arquivo de imagem ou vídeo."));
      }

      const sizeBytes = file.size;
      const localPath = file.path;
      localPathToCleanup = localPath;

      if (sizeBytes > MAX_FILE_BYTES) {
        fs.unlink(localPath, () => {});
        return res.status(400).json(
          uploadError("FILE_TOO_LARGE", "O arquivo enviado é maior que 100MB.", {
            maxBytes: MAX_FILE_BYTES,
          })
        );
      }

      const {
        tipo,
        titulo = "",
        descricao = "",
        atletaId,
        escolinhaId,
        clubeId,
        submissaoDesafioId,
        submissaoTreinoId,
        exercicioPersonalizadoId,
      } = (req.body || {}) as any;

      const requesterId = String((req as any).userId || (req as any).user?.id || "");
      const isAdminUser = Boolean((req as any).user?.isAdmin);

      const permitido = await verificarPosseAlvoUpload({
        isAdminUser,
        requesterId,
        atletaId,
        clubeId,
        escolinhaId,
        exercicioPersonalizadoId,
        submissaoDesafioId,
        submissaoTreinoId,
      });

      if (!permitido) {
        fs.unlink(localPath, () => {});
        return res
          .status(403)
          .json(uploadError("FORBIDDEN", "Sem permissão para enviar mídia para este destino."));
      }

      let tipoMidia: TipoMidia;
      if (tipo === "Imagem" || tipo === "Video" || tipo === "Documento") {
        tipoMidia = tipo as TipoMidia;
      } else if (file.mimetype.startsWith("image/")) {
        tipoMidia = TipoMidia.Imagem;
      } else if (file.mimetype.startsWith("video/")) {
        tipoMidia = TipoMidia.Video;
      } else {
        tipoMidia = TipoMidia.Documento;
      }

      let meta: {
        durationSec: number | null;
        width: number | null;
        height: number | null;
        fps: number | null;
      } = { durationSec: null, width: null, height: null, fps: null };

      try {
        if (tipoMidia === TipoMidia.Imagem) {
          const img: any = await probeImage(localPath);
          meta = {
            durationSec: null,
            width: img?.width ?? null,
            height: img?.height ?? null,
            fps: null,
          };
        } else if (tipoMidia === TipoMidia.Video) {
          const v: any = await probeVideo(localPath);
          meta = {
            durationSec: v?.durationSec ?? v?.duration ?? null,
            width: v?.width ?? null,
            height: v?.height ?? null,
            fps: v?.fps ?? null,
          };

          if (meta.durationSec && meta.durationSec > MAX_VIDEO_SEC) {
            fs.unlink(localPath, () => {});
            return res.status(400).json(
              uploadError("VIDEO_TOO_LONG", "O vídeo pode ter no máximo 60 segundos.", {
                maxSeconds: MAX_VIDEO_SEC,
                durationSec: meta.durationSec,
              })
            );
          }
        }
      } catch (e) {
        console.warn("[uploadMidia] ffprobe/sharp error:", e);
      }

      const filename = path.basename(localPath);
      const publicUrl = `/uploads/${filename}`;
      const base = baseUrlFromReq(req);
      const urlAbsLocal = `${base}${publicUrl}`;
      const midia = await prisma.midia.create({
        data: {
          url: urlAbsLocal,
          tipo: tipoMidia,
          dataEnvio: new Date(),
          descricao,
          titulo,
          atletaId: atletaId || null,
          escolinhaId: escolinhaId || null,
          clubeId: clubeId || null,
          submissaoDesafioId: submissaoDesafioId || null,
          submissaoTreinoId: submissaoTreinoId || null,
          sizeBytes,
          durationSec: meta.durationSec ?? null,
          width: meta.width ?? null,
          height: meta.height ?? null,
          fps: meta.fps ?? null,
          processedUrl: null,
          thumbUrl: null,
          storageClass: StorageClass.HOT,
        },
      });

      let thumbAbsLocal: string | null = null;
      if (tipoMidia === TipoMidia.Video) {
        try {
          const nameOnly = path.parse(filename).name;
          const thumbFilename = `${nameOnly}-thumb.jpg`;
          const thumbLocalPath = path.join(thumbsDir, thumbFilename);
          await generateVideoThumb(localPath, thumbLocalPath);
          const publicThumbUrl = `/uploads/thumbs/${thumbFilename}`;
          thumbAbsLocal = `${base}${publicThumbUrl}`;
        } catch (e) {
          console.warn("[uploadMidia] Falha ao gerar thumb local:", e);
        }
      }

      let processedUrl: string | null = null;
      let posterUrl: string | null = null;

      if (tipoMidia === TipoMidia.Video) {
        try {
          const out = await transcodeTo720p(midia.id, localPath);
          processedUrl = out.processedUrl ?? null;
          posterUrl = out.thumbUrl ?? null;
        } catch (e: any) {
          console.warn("[uploadMidia] transcode/S3 falhou, seguindo com URLs locais:", e?.message || e);
          processedUrl = null; 
          posterUrl = null;    
        }
      }

      const exId = String(exercicioPersonalizadoId || "").trim();
      if (exId && tipoMidia === TipoMidia.Video) {
        await prisma.exercicioPersonalizado.update({
          where: { id: exId },
          data: {
            videoDemonstrativoUrl: processedUrl,
            videoPosterUrl: posterUrl,
          },
        });
      }

      await audit(req, {
        acao: "UPLOAD_MIDIA",
        entidade: "Midia",
        entidadeId: midia.id,
        descricao: `Upload ${tipoMidia}`,
        meta: {
          sizeBytes,
          durationSec: meta.durationSec,
          width: meta.width,
          height: meta.height,
          exercicioPersonalizadoId: exId || null,
        },
      });

      const finalUrl = (processedUrl ?? midia.url);

      return res.status(201).json({
        ok: true,
        midiaId: midia.id,
        url: finalUrl,              
        relativeUrl: publicUrl,
        videoUrl: processedUrl,    
        posterUrl: posterUrl,      
        thumbUrl: posterUrl ?? thumbAbsLocal, 
      });
    } catch (err: any) {
      console.error("[uploadMidia] error:", err);
      return res.status(500).json({ message: "Erro no upload", error: err?.message });
    }
  },
];