import { Router } from "express";
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  solicitacoesTreinoController,
  aceitarSolicitacao,
  verificarVinculoTreino,
} from "../controllers/solicitacaoTreinoController.js";

const router = Router();

router.get("/minhas", listarSolicitacoesMinhas);
router.get("/recebidas", listarSolicitacoesRecebidas);
router.get("/vinculo", verificarVinculoTreino);
router.post("/:id/aceitar", aceitarSolicitacao);
router.post("/:id/recusar", recusarSolicitacao);
router.delete("/:id", cancelarSolicitacao);
router.delete("/dest/:destinatarioId", cancelarSolicitacao);
router.delete("/", cancelarSolicitacao);
router.post("/cancelar", cancelarSolicitacao);
router.post("/", criarSolicitacao);
router.put("/:id", async (req, res) => {
  try {
    const aceitar = !!req.body?.aceitar;
    if (aceitar) return solicitacoesTreinoController.aceitar(req, res);
    return recusarSolicitacao(req, res);
  } catch (e) {
    console.error("PUT /solicitacoes-treino/:id", e);
    res.status(500).json({ error: "Falha ao responder solicitação" });
  }
});

export default router;