import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarSolicitacao,
  listarSolicitacoesRecebidas,
  aceitarSolicitacao,
  recusarSolicitacao,
  cancelarSolicitacao,
} from "../controllers/solicitacaoTreinoController.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", criarSolicitacao);
router.get("/", listarSolicitacoesRecebidas);
router.delete("/:destinatarioId", cancelarSolicitacao);  
router.post("/cancelar", cancelarSolicitacao);    
router.put("/:id", async (req, res) => {
  const { aceitar } = (req.body ?? {}) as { aceitar?: boolean };
  return aceitar ? aceitarSolicitacao(req, res) : recusarSolicitacao(req, res);
});

export default router;