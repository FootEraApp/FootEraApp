import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { listarElencos, listarElencosMinha } from "../controllers/elencosController.js";

const router = Router();

router.get("/minha", authenticateToken, listarElencosMinha);
router.get("/", authenticateToken, listarElencos);

export default router;