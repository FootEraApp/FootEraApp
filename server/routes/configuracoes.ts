import express from "express";
import {
  getConfiguracoes,
  atualizarConfiguracoes,
  solicitarExclusaoConta,
  consultarDiagnosticoExclusaoConta,
} from "../controllers/configuracoesController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";

const router = express.Router();

router.get("/", getConfiguracoes);
router.patch(
  "/",
  authenticateToken,
  requireAdmin,
  atualizarConfiguracoes
);
router.get(
  "/minha-conta/diagnostico",
  authenticateToken,
  consultarDiagnosticoExclusaoConta,
);
router.delete(
  "/minha-conta",
  authenticateToken,
  solicitarExclusaoConta
);

export default router;