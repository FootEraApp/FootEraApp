import { Router } from "express";
import { editarPostagemGet, editarPostagemPost, deletarPostagem } from "../controllers/postController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

// Editar postagem (GET)
router.get("/:id", authenticateToken, editarPostagemGet);

// Editar postagem (POST)
router.post("/:id", authenticateToken, editarPostagemPost);

// Deletar postagem
router.delete("/:postagemId", authenticateToken, deletarPostagem);

export default router;