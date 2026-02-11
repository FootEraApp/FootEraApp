// server/routes/uploadMetodologias
import { Router } from "express";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { uploadMetodologiaVideo, uploadMetodologiaCapa } from "../controllers/metodologiasUploadController.js";

const storage = multer.diskStorage({
  async destination(req, file, cb) {
    try {
      const isVideo = file.mimetype?.startsWith("video");
      const sub = isVideo ? "videos" : "capas";
      const dest = path.join(process.cwd(), "uploads", "metodologias", sub);
      await fs.ensureDir(dest);
      cb(null, dest);
    } catch (e) {
      cb(e as any, path.join(process.cwd(), "uploads", "metodologias"));
    }
  },
  filename(req, file, cb) {
    const isVideo = file.mimetype?.startsWith("video");
    const ext =
      path.extname(file.originalname || (isVideo ? ".mp4" : ".png")) ||
      (isVideo ? ".mp4" : ".png");

    // opcional: tenta deixar o nome mais limpo
    const name = `${Date.now()}${isVideo ? "" : "-capa"}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

const router = Router();
router.use(authenticateToken);

// ✅ igual feed: campo do FormData
router.post("/video", upload.single("video"), uploadMetodologiaVideo);
router.post("/capa", upload.single("capa"), uploadMetodologiaCapa);

export default router;