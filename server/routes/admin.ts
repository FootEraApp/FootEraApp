import { Router } from "express";
import { adminDashboard, loginAdmin, adminDiagnostico } from "../controllers/adminController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import { adminRestaurarConta } from "../controllers/adminRestoreController.js";
import { getMe } from "../controllers/adminAdminsController.js";

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
router.get("/", authenticateToken, requireAdmin, adminDashboard);

export default router;