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
  markAllRead
} from "../controllers/mensagensController.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/grupos/:grupoId", authenticateToken, listarMensagensGrupo);
router.post("/grupos/:grupoId", authenticateToken, enviarMensagemGrupo);
router.post("/", authenticateToken, upload.single("midia"), enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);
router.delete("/:id", authenticateToken, deletarMensagem);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/unread", authenticateToken, listUnread);
router.post("/mark-all-read", authenticateToken, markAllRead);
export default router;