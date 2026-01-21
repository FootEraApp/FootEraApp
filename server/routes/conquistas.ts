import { Router } from "express";
import {
  getCatalog,
  compartilharConquista,
  getEarnedByUsuarioId,
  getAuditoria,
  syncAllUsuarios,
  getConquistasCount,
  getConquistaById,
} from "../controllers/conquistasController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/catalog/:entity", getCatalog);
router.get("/catalog", getCatalog);
router.get("/auditoria", getAuditoria);
router.get("/count", authenticateToken, getConquistasCount);
router.post("/sync-all", authenticateToken, syncAllUsuarios);
router.post("/compartilhar", authenticateToken, compartilharConquista);
router.get("/id/:id", getConquistaById);
router.get("/:usuarioId", getEarnedByUsuarioId);

export default router;