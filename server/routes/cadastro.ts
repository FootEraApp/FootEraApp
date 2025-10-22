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
  verificarEmail, 
  reenviarVerificacao,
} from "../controllers/cadastroController.js";

const router = express.Router();

router.get("/check/email", checarEmail);
router.get("/check/username", checarUsername);

router.get("/", getCadastroIndex);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);

router.post("/cadastro", cadastrarUsuario);
router.get("/verify", verificarEmail);
router.post("/resend-verification", reenviarVerificacao);
router.delete("/deletar/:id", deletarUsuario);

router.get("/buscar", buscarPerfisPublico); 


export default router;
