import express from "express";
import {
  getEscolinhas,
  getEscolinhaById,
  createEscolinha,
  updateEscolinha,
  deleteEscolinha,
  relatorioRetencaoEscolinha,
  listarHistoricoAtletasEscolinha,
  desvincularAtletaDaEscolinha
} from "../controllers/escolinhasController.js";
import { autorizarOrganizacaoLegada } from "../middlewares/autorizarOrganizacaoLegada.js";
import { requireAdmin } from "../middlewares/guards.js";

const router = express.Router();

router.get("/:escolinhaId/historico-atletas", listarHistoricoAtletasEscolinha);
router.get("/relatorios/retencao", relatorioRetencaoEscolinha);
router.get("/:id", getEscolinhaById);
router.get("/", getEscolinhas);
router.post(
  "/:escolinhaId/desvincular-atleta",
  autorizarOrganizacaoLegada("ESCOLINHA"),
  desvincularAtletaDaEscolinha,
);
router.post("/", requireAdmin, createEscolinha);
router.put(
  "/:id",
  autorizarOrganizacaoLegada("ESCOLINHA"),
  updateEscolinha,
);
router.delete("/:id", requireAdmin, deleteEscolinha);

export default router;