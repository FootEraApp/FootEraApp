import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireMembership } from "../middlewares/requireMembership.js";
import {
  listarElencos,
  getEscalaPorElencoId, 
  getEscalaPorDono,       
} from "../controllers/treinosController.js";

const router = Router();

router.get("/:id/escala", authenticateToken, getEscalaPorElencoId);
router.get("/por-escolinha/:escolinhaId/escala", authenticateToken, requireMembership, getEscalaPorDono);
router.get("/por-clube/:clubeId/escala",       authenticateToken, requireMembership, getEscalaPorDono);
router.get("/", authenticateToken, listarElencos);

export default router;