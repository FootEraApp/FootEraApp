import express from "express";
import {
  getCadastroIndex,
  getEscolhaTipo,
  getCriar,
  deletarUsuario,
  cadastrarUsuario
} from "../controllers/cadastroController";

const router = express.Router();

router.get("/", getCadastroIndex);
router.get("/escolha", getEscolhaTipo);
router.get("/criar", getCriar);
router.delete("/deletar/:id", deletarUsuario);
router.post("/", cadastrarUsuario);

export default router;