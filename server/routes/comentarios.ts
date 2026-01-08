import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { criarComentario, deletarComentario } from "../controllers/comentariosController.js";

const router = Router();

router.post("/", auth, criarComentario);
router.delete("/:comentarioId", auth, deletarComentario);

export default router;