import { Router } from "express";
import { editarPostagemGet, editarPostagemPost, deletarPostagem, curtirPost, comentarPost, getFeed, criarPostagem } from "../controllers/postController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/:id", authenticateToken, editarPostagemGet);
router.post("/:id", authenticateToken, editarPostagemPost);
router.delete("/:postagemId", authenticateToken, deletarPostagem);
router.post("/:id/like", authenticateToken, curtirPost);
router.post("/:id/comentario", authenticateToken, comentarPost);      
router.get("/feed", authenticateToken, getFeed);
router.post("/", authenticateToken, criarPostagem);
export default router;