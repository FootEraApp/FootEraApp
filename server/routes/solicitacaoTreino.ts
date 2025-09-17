import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarSolicitacao,
  listarSolicitacoesRecebidas,
  aceitarSolicitacao,
  recusarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
} from "../controllers/solicitacaoTreinoController.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/minhas", listarSolicitacoesMinhas);
router.post("/cancelar", cancelarSolicitacao);
router.delete("/:destinatarioId", cancelarSolicitacao);
router.put("/:id", (req, res) => {
  const { aceitar } = (req.body ?? {}) as { aceitar?: boolean };
  return aceitar ? aceitarSolicitacao(req, res) : recusarSolicitacao(req, res);
});
router.post("/", criarSolicitacao);
router.get("/", listarSolicitacoesRecebidas);

export default router;