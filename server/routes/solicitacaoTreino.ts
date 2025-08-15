import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarSolicitacao,
  listarSolicitacoesRecebidas,
  aceitarSolicitacao,
  recusarSolicitacao
} from "../controllers/solicitacaoTreinoController.js";

const router = express.Router();

router.use(authenticateToken);
router.post("/", criarSolicitacao);
router.get("/", listarSolicitacoesRecebidas);
router.put("/:id", async (req, res) => {
  const { aceitar } = req.body;
  if (aceitar) {
    return aceitarSolicitacao(req, res);
  } else {
    return recusarSolicitacao(req, res);
  }
});

export default router;