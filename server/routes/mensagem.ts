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
  markReadFromUser,
  getUnreadByUser,
  listarConversas,
  listarContatosRelacionados,
  markReadFromGroup,
  getUnreadByGroup,
} from "../controllers/mensagensController.js";
import { softRateLimit } from "../lib/rateLimit.js";
import {
  receberChatAudio, prepararAudioPrivado,
  baixarChatAudioPrivado, baixarChatAudioGrupo,
} from "../controllers/chatAudioHttp.js";

const router = Router();

router.use(authenticateToken);

router.get("/conversas", listarConversas);
router.get("/contatos-relacionados", listarContatosRelacionados);
router.get("/grupos/:grupoId", listarMensagensGrupo);
router.get("/audio/:id", baixarChatAudioPrivado);
router.get("/grupos/:grupoId/audio/:id", baixarChatAudioGrupo);
router.post("/audio", softRateLimit("msg"), receberChatAudio, prepararAudioPrivado, enviarMensagem);
router.post("/grupos/:grupoId/audio", softRateLimit("msg-grupo"), receberChatAudio, enviarMensagemGrupo);
router.post("/grupos/:grupoId", softRateLimit("msg-grupo"), enviarMensagemGrupo);
router.delete("/:id", deletarMensagem);
router.get("/unread-count", getUnreadCount);
router.get("/unread-by-user", getUnreadByUser);
router.get(
  "/unread-by-group",
  getUnreadByGroup
);
router.post("/mark-read/:otherId", markReadFromUser);
router.post(
  "/grupos/:grupoId/mark-read",
  markReadFromGroup
);
router.get("/unread", listUnread);
router.get("/", buscarMensagens);
router.post("/", softRateLimit("msg"), enviarMensagem);

export default router;