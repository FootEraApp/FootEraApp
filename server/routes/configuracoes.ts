import express from "express";
import {
  getConfiguracoes,
  atualizarConfiguracoes,
  solicitarExclusaoConta
} from "../controllers/configuracoesController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", getConfiguracoes);
router.patch("/", atualizarConfiguracoes);
router.delete("/configuracoes/minha-conta", authenticateToken, solicitarExclusaoConta);

export default router;