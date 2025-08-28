import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  enviarMensagem,
  buscarMensagens,
  listarMensagensGrupo,
  enviarMensagemGrupo,
  deletarMensagem
} from "../controllers/mensagensController.js";

const router = Router();

router.post("/", authenticateToken, enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);

router.get("/grupos/:grupoId", authenticateToken, listarMensagensGrupo);
router.post("/grupos/:grupoId", authenticateToken, enviarMensagemGrupo);
router.delete("/:id", authenticateToken, deletarMensagem);
export default router;
