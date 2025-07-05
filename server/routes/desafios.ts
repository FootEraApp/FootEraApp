import express from "express";
import {
  getDesafios,
  getDesafioById,
  criarSubmissaoDesafio,
  getSubmissoesPorDesafio,
  getSubmissoesPorAtleta
} from "../controllers/desafiosOficiaisController";

const router = express.Router();

router.get("/", getDesafios);
router.get("/:id", getDesafioById);
router.post("/:id/submissoes", criarSubmissaoDesafio);
router.get("/:id/submissoes", getSubmissoesPorDesafio);
router.get("/atleta/:atletaId/submissoes", getSubmissoesPorAtleta);

export default router;
