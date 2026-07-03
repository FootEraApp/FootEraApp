import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { criarComentario, deletarComentario } from "../controllers/comentariosController.js";

const router = Router();

router.post("/", authenticateToken, criarComentario);
router.delete("/:comentarioId", authenticateToken, deletarComentario);

export default router;