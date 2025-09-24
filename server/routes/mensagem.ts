import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  enviarMensagem,
  buscarMensagens,
  listarMensagensGrupo,
  enviarMensagemGrupo,
  deletarMensagem,
  getUnreadCount,
  listUnread,
  markAllRead,
  markReadFromUser,
  getUnreadByUser,
  listarConversas
} from "../controllers/mensagensController.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/conversas", authenticateToken, listarConversas);
router.get("/grupos/:grupoId", authenticateToken, listarMensagensGrupo);
router.post("/grupos/:grupoId", authenticateToken, enviarMensagemGrupo);
router.delete("/:id", authenticateToken, deletarMensagem);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/unread-by-user", authenticateToken, getUnreadByUser);
router.post("/mark-read/:otherId", authenticateToken, markReadFromUser);
router.get("/unread", authenticateToken, listUnread);
router.post("/mark-all-read", authenticateToken, markAllRead);
router.post("/", authenticateToken, upload.single("midia"), enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);

export default router;