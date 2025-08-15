import { Router } from "express";
import { seguirUsuario, deixarDeSeguir, listarSeguindo } from "../controllers/seguirController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.post("/", seguirUsuario);
router.delete("/", deixarDeSeguir);

router.get("/meus-seguidos", authenticateToken, listarSeguindo);

export default router;