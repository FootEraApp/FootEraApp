// server/controllers/uploadMetodologiasController
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../prisma.js";

// ajuste como quiser
const MAX_FILE_BYTES = 300 * 1024 * 1024; // 300MB
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
]);

/**
 * Pasta real no disco:
 * public/assets/videos/metodologias
 *
 * URL que o front acessa (porque você já serve /assets no index):
 * /assets/videos/metodologias/<arquivo>
 */
const metodologiasDir = path.join(
  process.cwd(),
  "public",
  "assets",
  "videos",
  "metodologias"
);

fs.mkdirSync(metodologiasDir, { recursive: true });

const storage = multer.diskStorage({
  destination: metodologiasDir,
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const uploadMetodologiaVideoMulter = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Formato inválido. Envie mp4/webm/mov."));
    }
    cb(null, true);
  },
});

// middleware principal
export async function uploadVideoMetodologia(req: Request, res: Response) {
  try {
    // ✅ auth já roda no index: app.use("/api/upload", authenticateToken, uploadRoutes);
    // mas caso você use req.user aqui, depende do seu authenticateToken.
    // normalmente: (req as any).user.id
    const usuarioId = String((req as any)?.user?.id || "");

    if (!usuarioId) {
      return res.status(401).json({ ok: false, message: "Não autenticado." });
    }

    // ✅ regra de plano (ajuste conforme seu schema)
    // aqui estou assumindo que você tem model Assinatura com status.
    const assinatura = await prisma.assinatura.findUnique({
      where: { usuarioId },
      select: { status: true, ativo: true, bloqueadoEm: true, renovaEm: true, trialEndsAt: true },
    });

    const status = String(assinatura?.status || "");
    const agora = new Date();

    const bloqueado = !!assinatura?.bloqueadoEm;
    const inativo = assinatura ? !assinatura.ativo : true;

    // se quiser respeitar trialEndsAt:
    const trialExpirou =
      status === "TRIAL" && assinatura?.trialEndsAt
        ? new Date(assinatura.trialEndsAt) < agora
        : false;

    const liberado = !bloqueado && !inativo && !trialExpirou && (status === "ATIVA" || status === "TRIAL");

    if (!liberado) {
      // remove arquivo se já foi salvo pelo multer
      const f = (req as any).file;
      if (f?.path) fs.unlink(f.path, () => {});
      return res.status(403).json({
        ok: false,
        message: "Recurso disponível apenas para assinantes (plano).",
        status,
      });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res
        .status(400)
        .json({ ok: false, message: "Envie um arquivo de vídeo no campo 'video'." });
    }

    if (file.size > MAX_FILE_BYTES) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        ok: false,
        message: "Arquivo maior que o limite permitido.",
        maxBytes: MAX_FILE_BYTES,
      });
    }

    const filename = path.basename(file.path);

    // ✅ URL relativa que o front usa direto:
    const relativeUrl = `/assets/videos/metodologias/${filename}`;

    // ✅ se você quiser URL absoluta:
    const base =
      process.env.BACKEND_URL ||
      process.env.API_BASE_URL ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get("host")}`;
    const urlAbs = `${String(base).replace(/\/+$/, "")}${relativeUrl}`;

    // opcional: salvar como Midia (se você quer rastrear/analytics)
    // Se não quiser criar Midia, pode remover esse bloco todo.
    const midia = await prisma.midia.create({
      data: {
        url: urlAbs,
        tipo: "Video" as any, // TipoMidia.Video (mas aqui sem importar pra não brigar com enums)
        dataEnvio: new Date(),
        titulo: (req.body?.titulo ?? "Vídeo metodologia") as string,
        descricao: (req.body?.descricao ?? "") as string,
        sizeBytes: file.size,
        durationSec: null,
        width: null,
        height: null,
        fps: null,
        processedUrl: null,
        thumbUrl: null,
        storageClass: "HOT" as any,
      },
    });

    return res.status(201).json({
      ok: true,
      url: urlAbs,
      relativeUrl,
      filename,
      midia, // se você não quiser, remove
    });
  } catch (err: any) {
    console.error("uploadVideoMetodologia error", err);
    return res.status(500).json({
      ok: false,
      message: "Erro no upload de vídeo da metodologia.",
      error: err?.message,
    });
  }
}
