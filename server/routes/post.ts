// server/routes/post
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../middlewares/auth.js";
import {
  postarConteudo,
  adicionarComentario,
  buscarPostagemPorId,
  registrarCompartilhamento,
  deletarPost,
  editarPostagemGet,
  editarPostagemPost,
  compartilharPostPorMensagem,
  repostarPost,
} from "../controllers/postController.js";
import { curtirPostagem } from "server/controllers/feedController.js";

const router = Router();

// >>> MESMA pasta dos outros uploads <<<
const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

// limite opcional (ex.: 200MB)
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// campo do arquivo deve ser "arquivo"
router.post(["/", "/postar"], authenticateToken, upload.single("arquivo"), postarConteudo);

router.get("/visualizar/:id", authenticateToken, buscarPostagemPorId);
router.post("/:postId/comentario", authenticateToken, adicionarComentario);
router.post("/:postId/like", authenticateToken, curtirPostagem);
router.post("/:postId/compartilhar", authenticateToken, registrarCompartilhamento);
router.post("/:postId/compartilhar/mensagem", authenticateToken, compartilharPostPorMensagem);
router.post("/:postId/repost", authenticateToken, repostarPost);
router.delete("/:id", authenticateToken, deletarPost);
router.get("/editar/:id", authenticateToken, editarPostagemGet);
router.post("/editar/:id", authenticateToken, editarPostagemPost);

export default router;
