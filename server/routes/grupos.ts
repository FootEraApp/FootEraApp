import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { criarGrupo, listarMeusGrupos } from "../controllers/gruposController.js";
import { listarMensagensGrupo, enviarMensagemGrupo, } from "../controllers/mensagensController.js";

const router = express.Router();

router.post("/", authenticateToken, criarGrupo);
router.get("/me", authenticateToken, listarMeusGrupos);

router.get("/:grupoId/mensagens", authenticateToken, listarMensagensGrupo);
router.post("/:grupoId/mensagens", authenticateToken, enviarMensagemGrupo);
export default router;