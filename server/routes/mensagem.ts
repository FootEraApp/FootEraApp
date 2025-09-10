import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  enviarMensagem,
  buscarMensagens,
  listarMensagensGrupo,
  enviarMensagemGrupo,
  deletarMensagem
} from "../controllers/mensagensController.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/grupos/:grupoId", authenticateToken, listarMensagensGrupo);
router.post("/grupos/:grupoId", authenticateToken, enviarMensagemGrupo);
router.post("/", authenticateToken, upload.single("midia"), enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);
router.delete("/:id", authenticateToken, deletarMensagem);

export default router;