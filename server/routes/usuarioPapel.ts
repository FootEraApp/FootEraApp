// server/routes/usuarioPapel.ts
import { Router } from "express";
import {
  adicionarPapel,
  alterarPapelAtivo,
  concluirPapel,
  listarMeusPapeis,
  alterarContextoAtivo,
  listarMeusContextos,
} from "../controllers/usuarioPapelController.js";

const router = Router();

router.get("/me/papeis", listarMeusPapeis);
router.get(
  "/me/contextos",
  listarMeusContextos
);

router.patch(
  "/me/contexto-ativo",
  alterarContextoAtivo
);
router.post("/me/papeis", adicionarPapel);
router.patch("/me/papeis/:papel/concluir", concluirPapel);
router.patch("/me/papel-ativo", alterarPapelAtivo);

export default router;