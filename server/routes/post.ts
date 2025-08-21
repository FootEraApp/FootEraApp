import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import {
  postarConteudo,
  adicionarComentario,
  buscarPostagemPorId,
  registrarCompartilhamento,
  deletarPost,
  editarPostagemGet,
  editarPostagemPost,
} from "../controllers/postController.js";
import { curtirPostagem } from "server/controllers/feedController.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post(["/", "/postar"], authenticateToken, upload.single("arquivo"), postarConteudo);
router.get("/visualizar/:id", authenticateToken, buscarPostagemPorId);
router.post("/:postId/comentario", authenticateToken, adicionarComentario);
router.post("/:postId/like", authenticateToken, curtirPostagem);
router.post("/:postId/compartilhar", authenticateToken, registrarCompartilhamento);
router.delete("/:id", authenticateToken, deletarPost);

router.get("/editar/:id", authenticateToken, editarPostagemGet);
router.post("/editar/:id", authenticateToken, editarPostagemPost);

export default router;