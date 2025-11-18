// controllers/uploadController.ts
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient, TipoMidia, StorageClass } from "@prisma/client";
import { probeImage, probeVideo } from "../services/mediaMetadata.js";
import { audit } from "../services/audit.js";
import { uploadError } from "../services/uploadErrors.js"; // <- corrige aqui
import { transcodeTo720p } from "../services/transcodeService.js";

const prisma = new PrismaClient();
const MAX_VIDEO_SEC = 60;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const queueTranscode = {
  add: async (_name: string, data: { midiaId: string; localPath: string }) => {
    // Versão simples: roda em "background" no mesmo processo
    setImmediate(() => {
      transcodeTo720p(data.midiaId, data.localPath).catch((err) => {
        console.error("Erro na transcodificação 720p:", err);
      });
    });
  },
};

const uploadsDir = path.join(process.cwd(), "public", "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
export const upload = multer({ storage });

export const uploadMidia = [
  upload.single("arquivo"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res
          .status(400)
          .json(
            uploadError(
              "FILE_REQUIRED",
              "Envie um arquivo de imagem ou vídeo."
            )
          );
      }

      const sizeBytes = file.size;
      const localPath = file.path;

      if (sizeBytes > MAX_FILE_BYTES) {
        fs.unlink(localPath, () => {});
        return res.status(400).json(
          uploadError("FILE_TOO_LARGE", "O arquivo enviado é maior que 50MB.", {
            maxBytes: MAX_FILE_BYTES,
          })
        );
      }

      // Dados do corpo
      const {
        tipo,
        titulo = "",
        descricao = "",
        atletaId,
        escolinhaId,
        clubeId,
        submissaoDesafioId,
        submissaoTreinoId,
      } = (req.body || {}) as {
        tipo?: string;
        titulo?: string;
        descricao?: string;
        atletaId?: string;
        escolinhaId?: string;
        clubeId?: string;
        submissaoDesafioId?: string;
        submissaoTreinoId?: string;
      };

      // Descobrir tipo da mídia
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

      // Metadata básica
      let meta: {
        durationSec: number | null;
        width: number | null;
        height: number | null;
        fps: number | null;
      } = {
        durationSec: null,
        width: null,
        height: null,
        fps: null,
      };

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
              uploadError(
                "VIDEO_TOO_LONG",
                "O vídeo pode ter no máximo 60 segundos.",
                {
                  maxSeconds: MAX_VIDEO_SEC,
                  durationSec: meta.durationSec,
                }
              )
            );
          }
        }
      } catch (e) {
        console.warn("ffprobe/sharp error", e);
      }

      // monta URL relativa e absoluta
      const filename = path.basename(localPath);
      const publicUrl = `/uploads/${filename}`;

      const base =
        process.env.BACKEND_URL ||
        process.env.API_BASE_URL ||
        process.env.APP_URL ||
        `${req.protocol}://${req.get("host")}`;
      const urlAbs = `${String(base).replace(/\/+$/, "")}${publicUrl}`;

      // grava no banco (modelo Midia do schema.prisma)
      const midia = await prisma.midia.create({
        data: {
          url: urlAbs, // URL "original" pública
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

      // Enfileira para transcodificar em 720p/30 (se tiver fila)
      await queueTranscode.add("transcode", {
        midiaId: midia.id,
        localPath,
      });

      // Auditar upload (seu service já existe)
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
        },
      });

      return res.status(201).json({ ok: true, midia });
    } catch (err: any) {
      console.error("uploadMidia error", err);
      return res
        .status(500)
        .json({ message: "Erro no upload", error: err?.message });
    }
  },
];
