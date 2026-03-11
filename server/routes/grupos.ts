import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { listarMensagensGrupo, enviarMensagemGrupo, } from "../controllers/mensagensController.js";
import {
  assignDesafioAoGrupo,
  submeterDesafioGrupo,
  getDesafioEmGrupo,
} from "../controllers/desafioGrupoController.js";
import {
  criarGrupo,
  listarMeusGrupos,
  detalharGrupo,
  adicionarMembrosGrupo,
  removerMembroGrupo,
  sairDoGrupo,
  listarUsuariosAdicionaveisNoGrupo,
  alterarTipoMembroGrupo,
} from "../controllers/gruposController.js";

const router = express.Router();

router.post("/desafios-grupo/:desafioEmGrupoId/submissoes", authenticateToken, submeterDesafioGrupo);
router.get("/me", authenticateToken, listarMeusGrupos);
router.get("/:grupoId/usuarios-adicionaveis", authenticateToken, listarUsuariosAdicionaveisNoGrupo);
router.patch("/:grupoId/membros/:membroId/tipo", authenticateToken, alterarTipoMembroGrupo);
router.post("/:grupoId/membros", authenticateToken, adicionarMembrosGrupo);
router.delete("/:grupoId/membros/:membroId", authenticateToken, removerMembroGrupo);
router.post("/:grupoId/sair", authenticateToken, sairDoGrupo);
router.post("/:grupoId/desafios/assign", authenticateToken, assignDesafioAoGrupo);
router.get("/desafios-grupo/:id", authenticateToken, getDesafioEmGrupo);
router.post("/desafios/submissoes-grupo", authenticateToken, submeterDesafioGrupo);
router.get("/:grupoId/mensagens", authenticateToken, listarMensagensGrupo);
router.post("/:grupoId/mensagens", authenticateToken, enviarMensagemGrupo);
router.get("/:grupoId", authenticateToken, detalharGrupo);
router.post("/", authenticateToken, criarGrupo);

export default router;