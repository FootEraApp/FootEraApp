import { Router } from "express";
import { getCatalog, compartilharConquista, getEarnedByUsuarioId, } from "../controllers/conquistasController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/catalog/:entity", getCatalog);
router.get("/catalog", getCatalog);
router.get("/:usuarioId", getEarnedByUsuarioId);
router.post("/compartilhar", authenticateToken, compartilharConquista);

export default router;