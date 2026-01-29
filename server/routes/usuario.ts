import { Router } from "express";
import { getUsuarioPorId, getUsuarioChallenges, getPresenca } from "../controllers/usuarioController.js";
import { authenticateToken } from "server/middlewares/auth.js";
import { listAdminUsers } from "server/controllers/adminUsersController.js";

const router = Router();

router.get("/", authenticateToken, listAdminUsers);
router.get("/:id", getUsuarioPorId);
router.get("/:id/challenges", authenticateToken, getUsuarioChallenges);
router.get("/:id/presenca", authenticateToken, getPresenca);

export default router;