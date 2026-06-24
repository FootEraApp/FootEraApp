import { Router } from "express";
import { adminDashboard, loginAdmin, adminDiagnostico } from "../controllers/adminController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";
import { adminRestaurarConta } from "../controllers/adminRestoreController.js";

const router = Router();

router.post("/login", loginAdmin);
router.post(
  "/usuarios/:id/restaurar",
  authenticateToken,
  requireAdmin,
  adminRestaurarConta
);
router.get("/me", authenticateToken, requireAdmin, (req, res) => {
  const user = (req as any).authUser;
  return res.json({
    id: user.id,
    email: user.email,
    nome: user.nome,
    tipo: user.tipo || user.tipoUsuario || "Admin",
    adminNivel: 1,
    canManageAdmins: true,
  });
});
router.get(
  "/diagnostico",
  authenticateToken,
  requireAdmin,
  adminDiagnostico
);
router.get("/", authenticateToken, requireAdmin, adminDashboard);

export default router;