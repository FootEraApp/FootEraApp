import { Router } from "express";
import { getCatalog, getEarnedByUsuarioId } from "../controllers/conquistasController.js";

const router = Router();

router.get("/catalog/:entity?", getCatalog);
router.get("/:usuarioId", getEarnedByUsuarioId);

export default router;