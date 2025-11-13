// server/routes/olheiros.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getIndicacoes,
  perfilOlheiro,
  getNota,
  setNota,
  patchColaboracao,
} from "../controllers/olheirosController.js";
import { listarObservadosPorOlheiro } from "../controllers/atletaObservadoController.js";

const router = Router();

router.get("/:id/indicacoes", getIndicacoes);
router.get("/perfil/olheiro/:id", authenticateToken, perfilOlheiro);
router.get("/:olheiroId/observados", authenticateToken, listarObservadosPorOlheiro);
router.get("/notas/:atletaId", authenticateToken, getNota);
router.put("/notas/:atletaId", authenticateToken, setNota);
router.patch("/:id", authenticateToken, patchColaboracao);

export default router;
