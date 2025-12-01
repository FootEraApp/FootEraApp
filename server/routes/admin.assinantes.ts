import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { listar, overview } from "../controllers/assinaturasAdminController.js";

const router = Router();

router.get("/", authenticateToken, listar);
router.get("/overview", authenticateToken, overview);

export default router;