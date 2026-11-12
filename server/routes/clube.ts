import express from "express";
import {
  getClubes,
  getClube,
  createClube,
  updateClube,
  deleteClube,
  listarHistoricoAtletasClube,
  desvincularAtletaDoClube,
} from "../controllers/clubesController.js";
import { autorizarOrganizacaoLegada } from "../middlewares/autorizarOrganizacaoLegada.js";
import { requireAdmin } from "../middlewares/guards.js";

const router = express.Router();

router.get("/:clubeId/historico-atletas", listarHistoricoAtletasClube);
router.get("/:id", getClube);
router.post(
  "/:clubeId/desvincular-atleta",
  autorizarOrganizacaoLegada("CLUBE"),
  desvincularAtletaDoClube,
);
router.post("/", requireAdmin, createClube);
router.put(
  "/:id",
  autorizarOrganizacaoLegada("CLUBE"),
  updateClube,
);
router.delete("/:id", requireAdmin, deleteClube);
router.get("/", getClubes);

export default router;