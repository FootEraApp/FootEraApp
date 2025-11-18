// server/routes/adminRoutes.ts
import { Router } from "express";
import { adminDashboard, loginAdmin } from "../controllers/adminController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  listAdminUsers,
  getAdminUserDetail,
  patchAdminUser,
  banUser,
  unbanUser,
  removeUserContent,
} from "../controllers/adminUsersController.js";
import { strictLimiter } from "../lib/rateLimit.js";   // <-- NOVO
import { listAuditLogs } from "../controllers/adminAuditController.js";

const router = Router();

// protege contra brute force no login de admin
router.post("/login", strictLimiter("admin_login"), loginAdmin);
router.use(authenticateToken, requireAdmin);

router.get("/audit-logs", listAuditLogs);
router.get("/usuarios/:id", getAdminUserDetail);
router.patch("/usuarios/:id", patchAdminUser);
router.post("/usuarios/:id/banir", banUser);
router.delete("/usuarios/:id/banir", unbanUser);
router.post("/usuarios/:id/remover-conteudo", removeUserContent);
router.get("/usuarios", listAdminUsers);
router.get("/", adminDashboard);

export default router;