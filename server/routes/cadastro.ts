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
  resendVerification,
} from "../controllers/cadastroController.js";

const router = express.Router();

router.get("/check/email", checarEmail);
router.get("/check/username", checarUsername);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);
router.get("/verify", verificarEmail);
router.post("/resend-verification", resendVerification);
router.delete("/deletar/:id", deletarUsuario);
router.get("/buscar", buscarPerfisPublico); 
router.get("/", getCadastroIndex);
router.post("/", cadastrarUsuario);

export default router;