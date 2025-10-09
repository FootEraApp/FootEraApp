import { Router, type RequestHandler } from "express";
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
import rateLimit from "express-rate-limit";
import { isAllowedMime } from "../utils/moderation.js";

const router = Router();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMime(file.mimetype)) return cb(null, true);
    cb(new Error("Tipo de arquivo não permitido (somente imagens JPEG/PNG/WEBP/GIF ou vídeo MP4/WEBM)."));
  },
});

// gerador simples por IP/usuário sem depender de tipos externos
const keyFromReq = (req: any) => (req?.userId ? `u:${req.userId}` : (req.ip || req.headers["x-forwarded-for"] || "ip:desconhecido"));

const postLimiterMw: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true, // usa boolean para compat com v6/v7
  legacyHeaders: false,
  keyGenerator: keyFromReq as any,
}) as unknown as RequestHandler;

const commentLimiterMw: RequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromReq as any,
}) as unknown as RequestHandler;

router.get("/visualizar/:id", authenticateToken, buscarPostagemPorId);
router.post("/:postId/comentario", authenticateToken, commentLimiterMw, adicionarComentario);
router.post("/:postId/like", authenticateToken, curtirPostagem);
router.post("/:postId/compartilhar", authenticateToken, registrarCompartilhamento);
router.post("/:postId/compartilhar/mensagem", authenticateToken, compartilharPostPorMensagem);
router.post("/:postId/repost", authenticateToken, repostarPost);
router.delete("/:id", authenticateToken, deletarPost);
router.get("/editar/:id", authenticateToken, editarPostagemGet);
router.post("/editar/:id", authenticateToken, editarPostagemPost);
router.post(["/", "/postar"], authenticateToken, postLimiterMw, upload.single("arquivo"), postarConteudo);

export default router;
