// server/routes/mensagensRoutes.ts
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
  listarConversas,
} from "../controllers/mensagensController.js";
import { canOpenDM } from "../utils/permissions.js";
import { softRateLimit } from "../lib/rateLimit.js"; // <-- aqui, sem "@/"

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateToken);

router.get("/conversas", listarConversas);
router.get("/grupos/:grupoId", listarMensagensGrupo);
router.post("/grupo/:grupoId", softRateLimit("msg-grupo"), enviarMensagemGrupo);
router.delete("/:id", deletarMensagem);
router.get("/unread-count", getUnreadCount);
router.get("/unread-by-user", getUnreadByUser);
router.post("/mark-read/:otherId", markReadFromUser);
router.get("/unread", listUnread);
router.get("/", buscarMensagens);
router.post("/", softRateLimit("msg"), enviarMensagem);

export default router;