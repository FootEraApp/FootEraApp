import { Router } from "express";
import { getCatalog, getEarnedByUsuarioId } from "../controllers/conquistasController.js";

const router = Router();

// IMPORTANTE: rotas específicas antes de rotas com parâmetros
router.get("/catalog/:entity?", getCatalog);

// earned para um usuário específico
router.get("/:usuarioId", getEarnedByUsuarioId);

export default router;
