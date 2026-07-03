import { Router } from "express";
import {
  listAdminUsers,
  getAdminUserDetail,
  hardDeleteUsuario,
  patchAdminUser,
} from "../controllers/adminUsersController.js";
import {
  bloquearUsuario,
  reativarUsuario,
} from "../controllers/adminUsuariosStatusController.js";
import { authenticateToken } from "../middlewares/auth.js"; 
import { requireAdmin } from "../middlewares/guards.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.post("/:id/bloquear", bloquearUsuario);
router.post("/:id/reativar", reativarUsuario);
router.patch("/:id", patchAdminUser);
router.get("/:id", getAdminUserDetail);
router.delete("/:id", hardDeleteUsuario);
router.get("/", listAdminUsers);

export default router;