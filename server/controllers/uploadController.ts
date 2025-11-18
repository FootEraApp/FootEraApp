// controllers/uploadController.ts
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient, TipoMidia } from "@prisma/client";
import { probeImage, probeVideo } from "../services/mediaMetadata.js";
import { audit } from "../services/audit.js";

const prisma = new PrismaClient();
const MAX_VIDEO_SEC = 60;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
  upload.single("arquivo"), // campo do form
  async (req: Request, res: Response) => {
    try {
      const { tipo, descricao = "", titulo = "", atletaId, escolinhaId, clubeId, submissaoDesafioId, submissaoTreinoId } =
        req.body as any;

      if (!req.file) return res.status(400).json({ code: "NO_FILE", message: "Arquivo não enviado." });
      if (!tipo) return res.status(400).json({ code: "NO_TYPE", message: "Informe 'tipo' (Imagem|Video|Documento)." });

      const localPath = req.file.path;
      const sizeBytes = Number(req.file.size ?? 0);
      const publicUrl = `/uploads/${req.file.filename}`;

      if (sizeBytes > MAX_FILE_BYTES) {
        fs.unlink(localPath, () => {});
        return res.status(400).json({ code: "MEDIA_TOO_LARGE", message: "Arquivo maior que 50MB." });
      }

      let meta: {
        durationSec: number | null;
        width: number | null;
        height: number | null;
      } = {
        durationSec: null,
        width: null,
        height: null,
      };

      try {
        if (tipo === "Imagem") {
          const img = await probeImage(localPath);
          meta = {
            durationSec: null,
            width: img.width ?? null,
            height: img.height ?? null,
          };
        }

        if (tipo === "Video") {
          const vid = await probeVideo(localPath);
          meta = {
            durationSec: vid.durationSec ?? null,
            width: vid.width ?? null,
            height: vid.height ?? null,
          };
        }
      } catch (e) {
        console.warn("ffprobe/sharp error", e);
      }

      if (tipo === "Video" && (meta.durationSec ?? 0) > MAX_VIDEO_SEC) {
        fs.unlink(localPath, () => {});
        return res.status(400).json({ code: "VIDEO_TOO_LONG", message: "Vídeo acima de 60s." });
      }

      // monta URL absoluta (útil pro client)
      const base =
        process.env.BACKEND_URL ||
        process.env.API_BASE_URL ||
        process.env.APP_URL ||
        `${req.protocol}://${req.get("host")}`;
      const urlAbs = `${String(base).replace(/\/+$/, "")}${publicUrl}`;

      const midia = await prisma.midia.create({
        data: {
          url: urlAbs, // ou publicUrl se preferir relativo
          tipo: tipo as TipoMidia,
          dataEnvio: new Date(),
          descricao,
          titulo,
          atletaId: atletaId || null,
          escolinhaId: escolinhaId || null,
          clubeId: clubeId || null,
          submissaoDesafioId: submissaoDesafioId || null,
          submissaoTreinoId: submissaoTreinoId || null,
          sizeBytes,
          durationSec: meta.durationSec,
          width: meta.width,
          height: meta.height,
        },
      });

      // (opcional) auditar upload
      await audit(req, {
        acao: "UPLOAD_MIDIA",
        entidade: "Midia",
        entidadeId: midia.id,
        descricao: `Upload ${tipo}`,
        meta: { sizeBytes, durationSec: meta.durationSec, width: meta.width, height: meta.height },
      });

      return res.status(201).json({ ok: true, midia });
    } catch (err: any) {
      console.error("uploadMidia error", err);
      return res.status(500).json({ message: "Erro no upload", error: err?.message });
    }
  },
];