import { Router } from "express";
import { adminDashboard, loginAdmin, adminDiagnostico } from "../controllers/adminController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import { adminRestaurarConta } from "../controllers/adminRestoreController.js";
import { getMe } from "../controllers/adminAdminsController.js";
import {
  listarPendenciasEventoAdmin,
  verificarPendenciaEventoNoMpAdmin,
} from "../controllers/adminBillingPendenciasController.js";

const router = Router();

router.post("/login", loginAdmin);
router.post(
  "/usuarios/:id/restaurar",
  authenticateToken,
  requireAdmin,
  adminRestaurarConta
);
router.get(
  "/me",
  authenticateToken,
  requireAdmin,
  getMe
);
router.get(
  "/diagnostico",
  authenticateToken,
  requireAdmin,
  adminDiagnostico
);
router.get(
  "/billing/pendencias-eventos",
  authenticateToken,
  requireAdmin,
  listarPendenciasEventoAdmin
);
router.get(
  "/billing/pendencias-eventos/:pagamentoId/verificar-provedor",
  authenticateToken,
  requireAdmin,
  verificarPendenciaEventoNoMpAdmin
);
router.get("/", authenticateToken, requireAdmin, adminDashboard);

export default router;