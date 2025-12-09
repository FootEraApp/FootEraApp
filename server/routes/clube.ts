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

const router = express.Router();

router.get("/:clubeId/historico-atletas", listarHistoricoAtletasClube);
router.get("/:id", getClube);
router.post("/:clubeId/desvincular-atleta", desvincularAtletaDoClube);
router.post("/", createClube);
router.put("/:id", updateClube);
router.delete("/:id", deleteClube);
router.get("/", getClubes);

export default router;