// server/routes/configuracoes
import express from "express";
import {
  getConfiguracoes,
  atualizarConfiguracoes,
  solicitarExclusaoConta,
} from "../controllers/configuracoesController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";

const router = express.Router();

// Público: login e aplicativo precisam consultar a manutenção
router.get("/", getConfiguracoes);

// Apenas administrador pode alterar configurações do sistema
router.patch(
  "/",
  authenticateToken,
  requireAdmin,
  atualizarConfiguracoes
);

// Usuário autenticado pode solicitar a exclusão da própria conta
router.delete(
  "/minha-conta",
  authenticateToken,
  solicitarExclusaoConta
);


export default router;