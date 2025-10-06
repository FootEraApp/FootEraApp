import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";
import {
  enviarMensagem,
  buscarMensagens,
  listarMensagensGrupo,
  enviarMensagemGrupo,
  deletarMensagem,
  getUnreadCount,
  listUnread,
  markReadFromUser,
  getUnreadByUser,
  listarConversas
} from "../controllers/mensagensController.js";
import { canOpenDM } from "../utils/permissions.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/conversas", authenticateToken, listarConversas);
router.get("/grupos/:grupoId", authenticateToken, listarMensagensGrupo);
router.post("/grupos/:grupoId", authenticateToken, enviarMensagemGrupo);
router.delete("/:id", authenticateToken, deletarMensagem);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/unread-by-user", authenticateToken, getUnreadByUser);
router.post("/mark-read/:otherId", authenticateToken, markReadFromUser);
router.get("/unread", authenticateToken, listUnread);
router.get("/", authenticateToken, buscarMensagens);

router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { paraId, conteudo, tipo } = req.body;

    const [sender, target] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: userId }, select: { id: true, tipo: true } }),
      prisma.usuario.findUnique({ where: { id: paraId }, select: { id: true, configuracoesPrivacidade: true } }),
    ]);

    if (!sender || !target) return res.status(404).json({ error: "Usuário não encontrado." });
    if (!canOpenDM(sender, target)) {
      return res.status(403).json({ error: "Este usuário não aceita DMs (apenas contas verificadas/permitidas)." });
    }

    return enviarMensagem(req, res);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

export default router;