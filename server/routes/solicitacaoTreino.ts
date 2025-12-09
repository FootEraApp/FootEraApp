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
  verificarVinculoTreino,
} from "../controllers/solicitacaoTreinoController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

// --- GETs ---
router.get("/minhas", listarSolicitacoesMinhas);
router.get("/recebidas", listarSolicitacoesRecebidas);
router.get("/vinculo", verificarVinculoTreino);

// --- criar solicitação ---
router.post("/", criarSolicitacao);

// --- aceitar / recusar (endpoints diretos) ---
router.post("/:id/aceitar", aceitarSolicitacao);
router.post("/:id/recusar", recusarSolicitacao);

// --- cancelar (várias formas) ---
// 1) DELETE /solicitacoes-treino/:id   -> pelo id da solicitação (bate com o front)
router.delete("/:id", cancelarSolicitacao);

// 2) DELETE /solicitacoes-treino/dest/:destinatarioId  -> cancela qualquer pendente entre mim e esse destinatário
router.delete("/dest/:destinatarioId", cancelarSolicitacao);

// 3) DELETE /solicitacoes-treino       -> cancela com base no body { destinatarioId } ou query ?destinatarioId
router.delete("/", cancelarSolicitacao);

// 4) POST /solicitacoes-treino/cancelar -> atalho compatível (mesma lógica do DELETE /)
router.post("/cancelar", cancelarSolicitacao);

// --- PUT legacy: aceita ou recusa baseado em req.body.aceitar ---
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