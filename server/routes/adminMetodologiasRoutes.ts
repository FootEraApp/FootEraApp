import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import {
  listMetodologiasPendentes,
  setMetodologiaAtivo,
  getMetodologiaPendenteDetail,
  listMinhasMetodologiasAdmin,
  deleteMinhaMetodologiaAdmin,
} from "../controllers/adminMetodologiasController.js";
import { listTodasMetodologiasAdmin } from "../controllers/metodologiasController.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/todas", listTodasMetodologiasAdmin);
router.get("/pendentes", listMetodologiasPendentes);
router.get("/minhas", listMinhasMetodologiasAdmin);
router.get("/:id", getMetodologiaPendenteDetail);
router.patch("/:id/ativo", setMetodologiaAtivo);
router.delete("/:id", deleteMinhaMetodologiaAdmin);

export default router;