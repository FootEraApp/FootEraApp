// server/routes/gerenciarOrganizacoesRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarMinhasOrganizacoesGerenciaveis,
  criarVinculoGestor,
  desativarVinculoGestor,

  // NOVO
  listarGestores,
  criarGestor,
  atualizarGestor,
  removerGestor,
} from "../controllers/gerenciarOrganizacoesController.js";

const router = Router();
router.use(authenticateToken);

// ✅ professor descobre o que pode gerenciar
router.get("/", listarMinhasOrganizacoesGerenciaveis);

// ✅ ROTAS QUE SEU FRONT ESTÁ CHAMANDO (para Clube/Escolinha/Admin)
router.get("/gestores", listarGestores);
router.post("/gestores", criarGestor);
router.put("/gestores/:id", atualizarGestor);
router.delete("/gestores/:id", removerGestor);

// ✅ (mantém as antigas)
router.post("/", criarVinculoGestor);
router.patch("/:id/desativar", desativarVinculoGestor);

export default router;