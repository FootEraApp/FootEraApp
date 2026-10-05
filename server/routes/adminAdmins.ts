import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getMe, createAdmin, deleteAdmin } from "../controllers/adminAdminsController.js";
import {
  requireAdmin,
} from "../middlewares/guards.js";
import {
  requireSuperAdmin,
} from "../middlewares/adminGuard.js";

const router = Router();

router.get("/me", authenticateToken, requireAdmin, getMe);
router.post("/admins", authenticateToken, requireSuperAdmin, createAdmin);
router.delete("/admins/:id", authenticateToken, requireSuperAdmin, deleteAdmin);

export default router;