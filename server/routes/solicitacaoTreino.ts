import { Router } from "express";
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  solicitacoesTreinoController
} from "../controllers/solicitacaoTreinoController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();
router.use(authenticateToken);

router.post("/:id/aceitar", solicitacoesTreinoController.aceitar);
router.post("/:id/recusar", recusarSolicitacao);
router.post("/", criarSolicitacao);
router.get("/minhas", listarSolicitacoesMinhas);
router.get("/", listarSolicitacoesRecebidas);
router.delete("/:destinatarioId?", cancelarSolicitacao);

export default router;