// server/routes/configuracoes
import express from "express";
import {
  getConfiguracoes,
  atualizarConfiguracoes,
  excluirConta,
} from "../controllers/configuracoesController.js";

const router = express.Router();

router.get("/", getConfiguracoes);
router.patch("/", atualizarConfiguracoes);

router.delete("/minha-conta", excluirConta);

export default router;
