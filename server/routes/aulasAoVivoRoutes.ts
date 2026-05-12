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
} from "../controllers/aulasAoVivoController.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/minhas", listarMinhasAulasAoVivo);

router.get("/:id", getAulaAoVivo);

router.post("/:id/broadcast-config", getBroadcastConfig);
router.post("/:id/iniciar", iniciarAulaAoVivo);
router.post("/:id/finalizar", finalizarAulaAoVivo);
router.post("/:id/cancelar", cancelarAulaAoVivo);

router.get("/:id/mensagens", listarMensagensAulaAoVivo);
router.post("/:id/mensagens", enviarMensagemAulaAoVivo);
router.patch("/:id/mensagens/:mensagemId/deletar", deletarMensagemAulaAoVivo);

export default router;