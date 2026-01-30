import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getPresenca, pingPresenca } from "../controllers/presencaController.js";

const router = Router();

// ver presença de qualquer usuário (pode deixar público se quiser, mas recomendo auth)
router.get("/:id", authenticateToken, getPresenca);

// atualiza presença do usuário logado
router.post("/ping", authenticateToken, pingPresenca);

export default router;