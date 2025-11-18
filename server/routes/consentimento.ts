// server/routes/consentimentoRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { atualizarConsentimentoOlheiro } from "../controllers/consentimentoController.js";
// se tiver um middleware de "requireResponsavel" ou algo assim, coloca aqui também

const router = Router();

router.use(authenticateToken);

// POST /api/consentimento/olheiro/:atletaId  { permitido: true/false }
router.post("/olheiro/:atletaId", atualizarConsentimentoOlheiro);

export default router;