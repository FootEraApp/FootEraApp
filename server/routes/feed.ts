import express from "express";
import {
  getFeed,
  curtirPostagem,
  comentarPostagem,
  seguirUsuario,
  postar,
  deletarPostagem
} from "../controllers/feedController";
import { authenticateToken } from "../middlewares/auth"; // middleware JWT

import multer from "multer";
const upload = multer({ dest: "public/uploads/posts" });

const router = express.Router();

// Requer autenticação em todas as rotas
router.use(authenticateToken);

router.get("/", getFeed);
router.post("/curtir", curtirPostagem);
router.post("/comentar", comentarPostagem);
router.post("/seguir", seguirUsuario);
router.post("/postar", upload.single("arquivo"), postar);
router.delete("/:id", deletarPostagem);

export default router;
