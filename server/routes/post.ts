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
import { isAllowedMime } from "../utils/moderation.js";
import { rateLimit, type ValueDeterminingMiddleware } from "express-rate-limit";

const router = Router();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMime(file.mimetype)) return cb(null, true);
    cb(
      new Error(
        "Tipo de arquivo não permitido (somente imagens JPEG/PNG/WEBP/GIF ou vídeo MP4/WEBM)."
      )
    );
  },
});

const byUserOrIp: ValueDeterminingMiddleware<string> = (req) => {
  const userId = (req as any)?.user?.id ?? (req as any)?.userId;
  if (userId) return `u:${userId}`;

  const raw =
    (req.ip ??
      (Array.isArray(req.headers["x-forwarded-for"])
        ? (req.headers["x-forwarded-for"][0] as string)
        : (req.headers["x-forwarded-for"] as string)) ??
      req.socket?.remoteAddress ??
      "") as string;

  const first = (raw || "").split(",")[0].trim();
  const clean = first
    .replace(/^::ffff:/, "") 
    .replace(/\]?:\d+$/, ""); 

  return `ip:${clean || "0.0.0.0"}`;
};

const postLimiterMw = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
}) as unknown as RequestHandler;

const commentLimiterMw = rateLimit({
  windowMs: 60 * 60 * 1000, 
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
}) as unknown as RequestHandler;

router.get("/visualizar/:id", authenticateToken, buscarPostagemPorId);

router.post(
  "/:postId/comentario",
  authenticateToken,
  commentLimiterMw,
  adicionarComentario
);

router.post("/:postId/like", authenticateToken, curtirPostagem);

router.post(
  "/:postId/compartilhar",
  authenticateToken,
  registrarCompartilhamento
);

router.post(
  "/:postId/compartilhar/mensagem",
  authenticateToken,
  compartilharPostPorMensagem
);

router.post("/:postId/repost", authenticateToken, repostarPost);

router.delete("/:id", authenticateToken, deletarPost);

router.get("/editar/:id", authenticateToken, editarPostagemGet);

router.post("/editar/:id", authenticateToken, editarPostagemPost);

router.post(
  ["/", "/postar"],
  authenticateToken,
  postLimiterMw,
  upload.single("arquivo"),
  postarConteudo
);

export default router;