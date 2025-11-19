// server/routes/elencos.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireMembership } from "../middlewares/requireMembership.js";
import {
  listarElencos,
  listarElencosMinha,
  escalaPorTurma,
  criarElenco,
  atualizarElenco,
  getEscalaPorElencoId,
  getEscalaPorDono,
  atletasVinculados,
  listarAtletasVinculados,
} from "../controllers/elencosController.js";

const router = Router();

// ⚠️ Ordem importa: “por-*” vem ANTES de "/:id/escala", senão "/:id" captura "por-clube".
router.get(
  "/por-escolinha/:escolinhaId/escala",
  authenticateToken,
  requireMembership,
  getEscalaPorDono
);
router.get(
  "/por-clube/:clubeId/escala",
  authenticateToken,
  requireMembership,
  getEscalaPorDono
);

// compatível com versão antiga que usava query ?tipoUsuarioId=...
router.get("/escala-por-dono", authenticateToken, getEscalaPorDono);

router.get("/escala-por-turma", authenticateToken, escalaPorTurma);
router.get("/minha", authenticateToken, listarElencosMinha);

// novas rotas de atletas vinculados (vindas do treinosController)
router.get("/atletas-vinculados", authenticateToken, atletasVinculados);
router.get("/atletas", authenticateToken, listarAtletasVinculados);

router.get("/:id/escala", authenticateToken, getEscalaPorElencoId);

router.get("/", authenticateToken, listarElencos);
router.post("/", authenticateToken, criarElenco);
router.put("/:id", authenticateToken, atualizarElenco);

export default router;
