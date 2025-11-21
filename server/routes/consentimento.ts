import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { atualizarConsentimentoOlheiro } from "../controllers/consentimentoController.js";

const router = Router();

router.use(authenticateToken);

router.post("/olheiro/:atletaId", atualizarConsentimentoOlheiro);

export default router;