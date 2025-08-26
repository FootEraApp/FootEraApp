import express from "express";
import {
  getCadastroIndex,
  getEscolhaTipo,
  getCriar,
  deletarUsuario,
  cadastrarUsuario
} from "../controllers/cadastroController.js";

const router = express.Router();

router.get("/", getCadastroIndex);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);
router.delete("/deletar/:id", deletarUsuario);
router.post("/cadastro", cadastrarUsuario);

export default router;