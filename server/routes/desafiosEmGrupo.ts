import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { progressoDesafioEmGrupo } from "server/controllers/desafioGrupoController.js";

const router = Router();
router.get("/:desafioEmGrupoId/progresso", authenticateToken, progressoDesafioEmGrupo);

export default router;