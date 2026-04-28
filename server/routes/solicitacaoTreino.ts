import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  aceitarSolicitacao,
  verificarVinculoTreino,
  desvincularTreino,
} from "../controllers/solicitacaoTreinoController.js";

const router = Router();

router.use(authenticateToken);

router.get("/minhas", listarSolicitacoesMinhas);
router.get("/recebidas", listarSolicitacoesRecebidas);
router.get("/vinculo", verificarVinculoTreino);
router.delete("/vinculo", authenticateToken, desvincularTreino);
router.post("/:id/aceitar", aceitarSolicitacao);
router.post("/:id/recusar", recusarSolicitacao);
router.delete("/dest/:destinatarioId", cancelarSolicitacao);
router.delete("/:id", cancelarSolicitacao);
router.delete("/", cancelarSolicitacao);
router.post("/cancelar", cancelarSolicitacao);
router.post("/", criarSolicitacao);

export default router;