import express, { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { criarGrupo, listarMeusGrupos } from "../controllers/gruposController.js";
import { listarMensagensGrupo, enviarMensagemGrupo, } from "../controllers/mensagensController.js";
import {
  assignDesafioAoGrupo,
  submeterDesafioGrupo,
  getDesafioEmGrupo,
} from "../controllers/desafioGrupoController.js";

const router = express.Router();

router.post("/", authenticateToken, criarGrupo);
router.get("/me", authenticateToken, listarMeusGrupos);

router.post("/:grupoId/desafios/assign", authenticateToken, assignDesafioAoGrupo);
router.get("/desafios-grupo/:id", authenticateToken, getDesafioEmGrupo);
router.post("/desafios/submissoes-grupo", authenticateToken, submeterDesafioGrupo);
router.post("/desafios-grupo/:desafioEmGrupoId/submissoes", authenticateToken, submeterDesafioGrupo);

router.get("/:grupoId/mensagens", authenticateToken, listarMensagensGrupo);
router.post("/:grupoId/mensagens", authenticateToken, enviarMensagemGrupo);
export default router;