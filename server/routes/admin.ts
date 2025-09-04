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

const router = Router();

router.post("/login", loginAdmin);
router.get("/", authenticateToken, requireAdmin, adminDashboard);

router.get("/usuarios", authenticateToken, requireAdmin, listAdminUsers);
router.get("/usuarios/:id", authenticateToken, requireAdmin, getAdminUserDetail);
router.patch("/usuarios/:id", authenticateToken, requireAdmin, patchAdminUser);
router.post("/usuarios/:id/banir", authenticateToken, requireAdmin, banUser);
router.delete("/usuarios/:id/banir", authenticateToken, requireAdmin, unbanUser);
router.post("/usuarios/:id/remover-conteudo", authenticateToken, requireAdmin, removeUserContent);

export default router;