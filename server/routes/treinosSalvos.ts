import express from "express";
import {
  criarTreinoSalvo,
  listarTreinosSalvos,
  reutilizarTreinoSalvo,
  deletarTreinoSalvo,
  limparTreinosSalvosExpirados,
} from "../controllers/treinosSalvosController.js";

const router = express.Router();

router.get("/", listarTreinosSalvos);

router.post("/", criarTreinoSalvo);

router.post("/:id/reutilizar", reutilizarTreinoSalvo);

router.delete("/:id", deletarTreinoSalvo);

router.delete("/__maintenance__/expirados", limparTreinosSalvosExpirados);

export default router;
