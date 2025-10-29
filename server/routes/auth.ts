import { Router } from "express";
import { login } from "../controllers/authController.js";
import { forgotPassword, resetPassword } from "../controllers/senhaController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { cadastrarUsuario, verificarEmail, resendVerification } from "../controllers/cadastroController.js";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.post("/cadastro", cadastrarUsuario);
router.post("/login", login);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);
router.post("/cadastro/resend-verification", resendVerification);
router.get("/cadastro/verify", verificarEmail);
router.get("/me", authenticateToken, (req: any, res) => {
  return res.json({
    id: req.userId,
    tipo: req.tipo,
    isAdmin: req.isAdmin === true,
    user: req.user, 
  });
});

export default router;