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

router.put("/gestores/:id", atualizarGestor);
router.delete("/gestores/:id", removerGestor);
router.get("/gestores", listarGestores);
router.post("/gestores", criarGestor);
router.patch("/:id/desativar", desativarVinculoGestor);
router.post("/", criarVinculoGestor);
router.get("/", listarMinhasOrganizacoesGerenciaveis);

export default router;