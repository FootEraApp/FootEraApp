import {
  getBadge,
  listarMinhasNotificacoes,
  recomputeAndEmitBadge,
  deletarNotificacao,
  getPushPublicKey,
  salvarPushSubscription,
  removerPushSubscription,
  testarPushAtual,
  getPushStatusAtual,
  salvarPushNativeToken,
  removerPushNativeToken
} from "../controllers/notificacoesController.js";
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

router.delete("/:id", authenticateToken, deletarNotificacao);
router.get("/me", authenticateToken, listarMinhasNotificacoes);
router.get("/badge", authenticateToken, getBadge);
router.post("/push/native/subscribe", authenticateToken, salvarPushNativeToken);
router.post("/push/native/unsubscribe", authenticateToken, removerPushNativeToken);
router.get("/push/public-key", authenticateToken, getPushPublicKey);
router.post("/push/subscribe", authenticateToken, salvarPushSubscription);
router.post("/push/unsubscribe", authenticateToken, removerPushSubscription);
router.post("/push/test", authenticateToken, testarPushAtual);
router.get("/push/status", authenticateToken, getPushStatusAtual);
router.patch("/:id/lida", authenticateToken, async (req: any, res) => {
  try {
    const id = String(req.params.id || "");
    const usuarioId = String(req.userId || "");
    if (!id || !usuarioId) return res.status(400).json({ error: "Dados inválidos" });

    await prisma.notificacao.updateMany({
      where: { id, usuarioId },
      data: { lida: true },
    });

    await recomputeAndEmitBadge(usuarioId);

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao marcar como lida" });
  }
});

export default router;