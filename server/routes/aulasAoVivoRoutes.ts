// server/routes/aulasAoVivoRoutes
import { Router } from "express";
import {
  getAulaAoVivo,
  getBroadcastConfig,
  iniciarAulaAoVivo,
  finalizarAulaAoVivo,
  cancelarAulaAoVivo,
  listarMensagensAulaAoVivo,
  enviarMensagemAulaAoVivo,
  deletarMensagemAulaAoVivo,
  listarMinhasAulasAoVivo,
  atualizarAulaAoVivoAvulsa,
  deletarAulaAoVivoAvulsa,
  criarAulaAoVivoAvulsa,
  sincronizarReplayAulaAoVivo,
  registrarPresencaAulaAoVivo,
  sairPresencaAulaAoVivo
} from "../controllers/aulasAoVivoController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/minhas", listarMinhasAulasAoVivo);

router.post("/:id/broadcast-config", getBroadcastConfig);
router.post("/:id/iniciar", iniciarAulaAoVivo);
router.post("/:id/finalizar", finalizarAulaAoVivo);
router.post("/:id/cancelar", cancelarAulaAoVivo);
router.post(
  "/:id/replay/sincronizar",
  sincronizarReplayAulaAoVivo
);
router.post(
  "/:id/sincronizar-replay",
  sincronizarReplayAulaAoVivo
);
router.patch("/:id/mensagens/:mensagemId/deletar", deletarMensagemAulaAoVivo);
router.get("/:id/mensagens", listarMensagensAulaAoVivo);
router.post("/:id/mensagens", enviarMensagemAulaAoVivo);
router.post("/:id/presenca/sair", sairPresencaAulaAoVivo);
router.post("/:id/presenca", registrarPresencaAulaAoVivo);
router.get("/:id", getAulaAoVivo);
router.put("/:id", atualizarAulaAoVivoAvulsa);
router.delete("/:id", deletarAulaAoVivoAvulsa);
router.post("/", criarAulaAoVivoAvulsa);

export default router;