// server/routes/treinoUnico.ts
import { Router } from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import { getTreinoUnico } from "server/controllers/TreinoUnicoController.js";

const router = Router();

// GET /api/treino-unico?agendadoId=...   OU   ?programadoId=...
// autenticar se quiser restringir — hoje o restante dos treinos usa auth em vários endpoints.
// Se quiser público, remova o authenticateToken abaixo.
router.get("/", authenticateToken, getTreinoUnico);

export default router;
