import { Router } from "express";
import {
  getPontuacaoAtleta,
  atualizarPontuacaoAtleta,
  getRanking
} from "../controllers/pontuacoesController.js";
import { pontuacaoDoPerfil } from "../controllers/pontuacoesController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();

router.get("/:usuarioId", authenticateToken, pontuacaoDoPerfil);
router.get("/", authenticateToken, pontuacaoDoPerfil);
router.get("/atletas/:atletaId/pontuacao", getPontuacaoAtleta);
router.put("/atletas/:atletaId/pontuacao", atualizarPontuacaoAtleta);
router.get("/ranking", getRanking);

export default router;