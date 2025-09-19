import { Router } from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import { getTreinoUnico } from "server/controllers/TreinoUnicoController.js";

const router = Router();

router.get("/", authenticateToken, getTreinoUnico);

export default router;