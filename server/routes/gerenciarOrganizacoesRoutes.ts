// server/routes/gerenciarOrganizacoesRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarMinhasOrganizacoesGerenciaveis,
  criarVinculoGestor,
  desativarVinculoGestor,
  listarGestores,
  criarGestor,
  atualizarGestor,
  removerGestor,
  solicitarTransferenciaPropriedade,
  sairDaOrganizacao,
  buscarDestinatariosTransferencia,
  listarTransferenciasRecebidas,
  responderTransferenciaRecebida,
  listarHistoricoTransferencias,
} from "../controllers/gerenciarOrganizacoesController.js";

const router = Router();
router.use(authenticateToken);

router.get(
  "/transferencias/historico",
  listarHistoricoTransferencias,
);
router.get(
  "/transferencias/recebidas",
  listarTransferenciasRecebidas,
);
router.post(
  "/transferencias/:transferenciaId/responder",
  responderTransferenciaRecebida,
);
router.get(
  "/minhas/:organizacaoId/transferencias/destinatarios",
  buscarDestinatariosTransferencia,
);
router.post(
  "/minhas/:organizacaoId/transferencias",
  solicitarTransferenciaPropriedade,
);
router.post(
  "/minhas/:organizacaoId/sair",
  sairDaOrganizacao
);
router.put("/gestores/:id", atualizarGestor);
router.delete("/gestores/:id", removerGestor);
router.get("/gestores", listarGestores);
router.post("/gestores", criarGestor);
router.patch("/:id/desativar", desativarVinculoGestor);
router.post("/", criarVinculoGestor);
router.get("/", listarMinhasOrganizacoesGerenciaveis);

export default router;