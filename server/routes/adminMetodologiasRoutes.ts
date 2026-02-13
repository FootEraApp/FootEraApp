import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import {
  listMetodologiasPendentes,
  setMetodologiaAtivo,
  getMetodologiaPendenteDetail,
} from "../controllers/adminMetodologiasController.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// GET /api/admin/metodologias/pendentes
router.get("/pendentes", listMetodologiasPendentes);

router.get("/:id", getMetodologiaPendenteDetail);

// PATCH /api/admin/metodologias/:id/ativo  body: { ativo: true|false }
router.patch("/:id/ativo", setMetodologiaAtivo);

export default router;