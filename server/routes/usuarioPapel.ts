// server/routes/usuarioPapel.ts
import { Router } from "express";

import {
  adicionarPapel,
  alterarPapelAtivo,
  concluirPapel,
  listarMeusPapeis,
} from "../controllers/usuarioPapelController.js";

const router = Router();

// O authenticateToken já é aplicado no server/index.ts para /api/usuarios.
router.get("/me/papeis", listarMeusPapeis);
router.post("/me/papeis", adicionarPapel);
router.patch("/me/papeis/:papel/concluir", concluirPapel);
router.patch("/me/papel-ativo", alterarPapelAtivo);

export default router;
