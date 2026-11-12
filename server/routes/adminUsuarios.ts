import { Router } from "express";
import {
  listAdminUsers,
  getAdminUserDetail,
  hardDeleteUsuario,
  patchAdminUser,
  excluirPapeisUsuarioAdmin,
} from "../controllers/adminUsersController.js";
import {
  bloquearUsuario,
  reativarUsuario,
} from "../controllers/adminUsuariosStatusController.js";
import { authenticateToken } from "../middlewares/auth.js"; 
import { requireAdmin } from "../middlewares/guards.js";
import {
  requireSuperAdmin,
} from "../middlewares/adminGuard.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.post("/:id/bloquear", bloquearUsuario);
router.post("/:id/reativar", reativarUsuario);
router.post(
  "/:id/desativar-papeis",
  requireSuperAdmin,
  excluirPapeisUsuarioAdmin,
);
router.patch("/:id", patchAdminUser);
router.get("/:id", getAdminUserDetail);
router.delete(
  "/:id",
  requireSuperAdmin,
  hardDeleteUsuario
);
router.get("/", listAdminUsers);

export default router;