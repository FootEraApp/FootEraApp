import { Router } from "express";
import {
  getPontuacaoAtleta,
  atualizarPontuacaoAtleta,
  getRanking
} from "../controllers/pontuacoesController";

const router = Router();

// Rota aninhada sob atleta
router.get("/atletas/:atletaId/pontuacao", getPontuacaoAtleta);
router.put("/atletas/:atletaId/pontuacao", atualizarPontuacaoAtleta);

// Ranking global (categoria e regiao como query param opcionais)
router.get("/ranking", getRanking);

export default router;