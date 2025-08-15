import { Router } from "express";
import {
  getPontuacaoAtleta,
  atualizarPontuacaoAtleta,
  getRanking
} from "../controllers/pontuacoesController.js";

const router = Router();

router.get("/atletas/:atletaId/pontuacao", getPontuacaoAtleta);
router.put("/atletas/:atletaId/pontuacao", atualizarPontuacaoAtleta);
router.get("/ranking", getRanking);

export default router;