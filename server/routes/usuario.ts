import { Router } from "express";
import { getUsuarioPorId, getUsuarioChallenges } from "../controllers/usuarioController.js";
import { authenticateToken } from "server/middlewares/auth.js";
const router = Router();

router.get("/:id", getUsuarioPorId);
router.get("/:id/challenges", authenticateToken, getUsuarioChallenges);

export default router;