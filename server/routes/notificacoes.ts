import { getBadge, listarMinhasNotificacoes } from "../controllers/notificacoesController.js";
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/me", authenticateToken, listarMinhasNotificacoes);
router.get("/badge", authenticateToken, getBadge);

export default router;