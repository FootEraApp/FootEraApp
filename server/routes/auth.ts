import { Router } from "express";
import { login, me, logout } from "../controllers/authController.js";
import { forgotPassword, resetPassword } from "../controllers/senhaController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { PrismaClient } from "@prisma/client";
import { restaurarConta } from "../controllers/authRestoreController.js";

const router = Router();
const prisma = new PrismaClient();

router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);
router.get("/me", authenticateToken, me);
router.post("/restaurar-conta", restaurarConta);

export default router;