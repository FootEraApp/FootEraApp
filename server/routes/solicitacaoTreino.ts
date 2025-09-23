import { Router } from "express";
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  solicitacoesTreinoController
} from "../controllers/solicitacaoTreinoController.js";

const router = Router();

router.post("/:id/aceitar", solicitacoesTreinoController.aceitar);
router.post("/:id/recusar", recusarSolicitacao);
router.post("/", criarSolicitacao);
router.get("/minhas", listarSolicitacoesMinhas);
router.get("/", listarSolicitacoesRecebidas);
router.delete("/:destinatarioId?", cancelarSolicitacao);

export default router;