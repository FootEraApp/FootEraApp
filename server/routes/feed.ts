import express, { Router } from "express";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { adminAuth } from "../middlewares/admin-auth.js";
import {
  getFeedPosts,
  seguirUsuario,
  postar,
  deletarPostagem,
  getPerfil,
  deletarUsuario
} from "../controllers/feedController.js";

const storage = multer.diskStorage({
  async destination(req, file, cb) {
    try {
      const texto =
        (req.body?.descricao && req.body.descricao.length ? req.body.descricao : req.body?.conteudo) || "";
      const isCard = /Meu Card FOOTERA/i.test(texto);
      const isVideo = file.mimetype?.startsWith("video");

      const sub = isVideo ? "videos" : (isCard ? "cards" : "posts");
      const dest = path.join(process.cwd(), "uploads", sub);
      await fs.ensureDir(dest);
      cb(null, dest);
    } catch (e) {
      cb(e as any, path.join(process.cwd(), "uploads", "posts"));
    }
  },
  filename(req, file, cb) {
    const texto =
      (req.body?.descricao && req.body.descricao.length ? req.body.descricao : req.body?.conteudo) || "";
    const isCard = /Meu Card FOOTERA/i.test(texto);
    const isVideo = file.mimetype?.startsWith("video");
    const ext = path.extname(file.originalname || (isVideo ? ".mp4" : ".png")) || (isVideo ? ".mp4" : ".png");
    const name = `${Date.now()}${!isVideo && isCard ? "-card" : ""}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

const router = Router();

router.use(authenticateToken);

router.get("/perfil/:id", authenticateToken, getPerfil);
router.delete("/usuario/:id", adminAuth, deletarUsuario);
router.post("/seguir", seguirUsuario);
router.post("/postar", upload.single("arquivo"), postar);
router.post("/post", upload.single("arquivo"), postar);
router.delete("/posts/:id", authenticateToken, deletarPostagem);
router.get("/", authenticateToken, getFeedPosts);

export default router;