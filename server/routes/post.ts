import { Router } from "express";
import { editarPostagemGet, editarPostagemPost, deletarPostagem, curtirPost, comentarPost, getFeed, criarPostagem, compartilharPostagem } from "../controllers/postController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.post("/postar", authenticateToken, criarPostagem);
router.get("/:id", authenticateToken, editarPostagemGet);
router.put("/:id", authenticateToken, editarPostagemPost);
router.delete("/:postagemId", authenticateToken, deletarPostagem);
router.post("/:id/like", authenticateToken, curtirPost);
router.post("/:id/comentario", authenticateToken, comentarPost);    
router.post("/:id/compartilhar", compartilharPostagem);  
router.get("/feed", authenticateToken, getFeed);


export default router;