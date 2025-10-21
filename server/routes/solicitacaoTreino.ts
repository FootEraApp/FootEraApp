// server/routes/solicitacaoTreino
import { Router } from "express";
import {
  criarSolicitacao,
  cancelarSolicitacao,
  listarSolicitacoesMinhas,
  listarSolicitacoesRecebidas,
  recusarSolicitacao,
  solicitacoesTreinoController,
  aceitarSolicitacao,
} from "../controllers/solicitacaoTreinoController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();
router.use(authenticateToken);

router.post("/:id/aceitar", aceitarSolicitacao);
router.post("/:id/recusar", recusarSolicitacao);

router.post("/", criarSolicitacao);
router.get("/minhas", listarSolicitacoesMinhas);
router.get("/", listarSolicitacoesRecebidas);

// ---- cancelamento (três formas) ----
router.delete("/id/:id", cancelarSolicitacao);              // por ID da solicitação
router.delete("/dest/:destinatarioId", cancelarSolicitacao); // por destinatário
router.delete("/", cancelarSolicitacao);                     // por body { destinatarioId }
router.post("/cancelar", cancelarSolicitacao);               // compat

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