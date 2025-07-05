import express from "express";
import {
  getCadastroIndex,
  getEscolhaTipo,
  getCriar,
  deletarUsuario,
  criarUsuario
} from "../controllers/cadastroController";

const router = express.Router();

router.get("/", getCadastroIndex);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);
router.delete("/deletar/:id", deletarUsuario);
router.post("/", criarUsuario);

export default router;
