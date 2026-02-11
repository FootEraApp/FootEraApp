// server/routes/upload
import { Router } from "express";
import { uploadMidia } from "../controllers/uploadController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../middlewares/auth.js";
import { UPLOADS_ROOT } from "../utils/uploads.js";

const router = Router();
const capaDir = path.join(UPLOADS_ROOT, "metodologias", "capas");
fs.mkdirSync(capaDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, capaDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safe = `capa_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post(
  "/metodologias/capa",
  authenticateToken,
  upload.single("capa"),
  (req, res) => {
    const f = (req as any).file;
    if (!f) return res.status(400).json({ message: "Envie um arquivo no campo 'capa'." });

    // ⚠️ o caminho público depende de como você serve UPLOADS_ROOT
    const relativeUrl = `/uploads/metodologias/capas/${f.filename}`;
    return res.json({
      ok: true,
      filename: f.filename,
      relativeUrl,
      url: relativeUrl,
    });
  }
);

router.post("/perfil", ...uploadMidia);

export default router;