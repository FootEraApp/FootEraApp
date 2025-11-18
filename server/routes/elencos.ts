import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireMembership } from "../middlewares/requireMembership.js";
import { getEscalaPorElencoId, getEscalaPorDono } from "../controllers/treinosController.js";
import {
  listarElencos,
  listarElencosMinha,
  escalaPorTurma,
  criarElenco,
  atualizarElenco,
} from "../controllers/elencosController.js";

const router = Router();

router.get("/por-escolinha/:escolinhaId/escala", authenticateToken, requireMembership, getEscalaPorDono);
router.get("/por-clube/:clubeId/escala", authenticateToken, requireMembership, getEscalaPorDono);

router.get("/escala-por-turma", authenticateToken, escalaPorTurma);
router.get("/minha", authenticateToken, listarElencosMinha);

router.get("/:id/escala", authenticateToken, getEscalaPorElencoId);

router.get("/", authenticateToken, listarElencos);
router.post("/", authenticateToken, criarElenco);
router.put("/:id", authenticateToken, atualizarElenco);

export default router;