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

const router = express.Router();

router.post("/:escolinhaId/desvincular-atleta", desvincularAtletaDaEscolinha);
router.get("/:escolinhaId/historico-atletas", listarHistoricoAtletasEscolinha);
router.get("/relatorios/retencao", relatorioRetencaoEscolinha);
router.get("/:id", getEscolinhaById);
router.get("/", getEscolinhas);
router.post("/", createEscolinha);
router.put("/:id", updateEscolinha);
router.delete("/:id", deleteEscolinha);

export default router;