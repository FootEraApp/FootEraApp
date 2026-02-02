import { Router } from "express";
import {
  listAdminUsers,
  getAdminUserDetail,
} from "../controllers/adminUsersController.js";
import {
  bloquearUsuario,
  reativarUsuario,
} from "../controllers/adminUsuariosStatusController.js";

import { authenticateToken } from "../middlewares/auth.js";   // ✅ ADD
import { requireAdmin } from "../middlewares/guards.js";

const router = Router();

// ✅ ordem correta: autentica -> depois valida admin
router.use(authenticateToken, requireAdmin);

router.post("/:id/bloquear", bloquearUsuario);
router.post("/:id/reativar", reativarUsuario);
router.get("/:id", getAdminUserDetail);
router.get("/", listAdminUsers);

export default router;