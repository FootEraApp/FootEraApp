import { Router } from "express";
import { adminDashboard, loginAdmin } from "../controllers/adminController.js";
import { adminAuth } from "server/middlewares/admin-auth.js";

const router = Router();

router.post("/login", loginAdmin);

router.get("/me", adminAuth, (req, res) => {
  const user = (req as any).user;
  return res.json({
    id: user.id,
    email: user.email,
    nome: user.nome,
    tipo: user.tipo || user.tipoUsuario || "Admin",
    adminNivel: 1,
    canManageAdmins: true,
  });
});
router.get("/", adminAuth, adminDashboard);

export default router;