import { Router } from "express";
import { login } from "../controllers/authController.js";
import { cadastrarUsuario } from "../controllers/cadastroController.js";
import { forgotPassword, resetPassword } from "../controllers/senhaController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.post("/cadastro", cadastrarUsuario);
router.post("/login", login);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);
router.get("/me", authenticateToken, (req: any, res) => {
  return res.json({
    id: req.userId,
    tipo: req.tipo,
    isAdmin: req.isAdmin === true,
    user: req.user, 
  });
});

export default router;