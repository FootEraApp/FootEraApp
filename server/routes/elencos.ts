import { Router } from "express";
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
  excluirElenco,
} from "../controllers/elencosController.js";

const router = Router();

router.get("/escala-por-dono", getEscalaPorDono);
router.get("/escala-por-turma", escalaPorTurma);
router.get("/minha", listarElencosMinha);

router.get("/atletas-vinculados", atletasVinculados);
router.get("/atletas", listarAtletasVinculados);

router.get(
  "/por-escolinha/:escolinhaId/escala",
  requireMembership,
  getEscalaPorDono
);
router.get(
  "/por-clube/:clubeId/escala",
  requireMembership,
  getEscalaPorDono
);

router.get("/:id/escala", getEscalaPorElencoId);
router.delete(
  "/:id",
  excluirElenco
);
router.get("/", listarElencos);
router.post("/", criarElenco);
router.put("/:id", atualizarElenco);

export default router;