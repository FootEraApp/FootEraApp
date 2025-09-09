// server/routes/cadastro
import express from "express";
import {
  getCadastroIndex,
  getEscolhaTipo,
  getCriar,
  deletarUsuario,
  cadastrarUsuario,
  checarEmail,
  checarUsername,
  buscarPerfisPublico,
} from "../controllers/cadastroController.js";

const router = express.Router();

router.get("/check/email", checarEmail);
router.get("/check/username", checarUsername);

router.get("/", getCadastroIndex);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);

router.post("/cadastro", cadastrarUsuario);
router.delete("/deletar/:id", deletarUsuario);

router.get("/buscar", buscarPerfisPublico); // sem auth


export default router;
