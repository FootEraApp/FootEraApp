// server/routes/solicitacaoTreino
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js"; // ✅ add (recomendado)
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  aceitarSolicitacao,
  verificarVinculoTreino,
} from "../controllers/solicitacaoTreinoController.js";

const router = Router();

// ✅ garante auth mesmo se você usar esse router fora do index
router.use(authenticateToken);

// LISTAS
router.get("/minhas", listarSolicitacoesMinhas);
router.get("/recebidas", listarSolicitacoesRecebidas);
router.get("/vinculo", verificarVinculoTreino);

// AÇÕES
router.post("/:id/aceitar", aceitarSolicitacao);
router.post("/:id/recusar", recusarSolicitacao);

// ✅ MAIS ESPECÍFICA PRIMEIRO
router.delete("/dest/:destinatarioId", cancelarSolicitacao);

// ✅ depois a genérica
router.delete("/:id", cancelarSolicitacao);

// ✅ opcional: cancelar via body/query
router.delete("/", cancelarSolicitacao);
router.post("/cancelar", cancelarSolicitacao);

// CRIAR
router.post("/", criarSolicitacao);

export default router;