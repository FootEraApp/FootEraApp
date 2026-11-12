// server/routes/adminCorrecaoNascimento.ts
import { Router } from "express";
import {
  authenticateToken,
} from "../middlewares/auth.js";
import {
  requireAdmin,
} from "../middlewares/guards.js";
import {
  requireSuperAdmin,
} from "../middlewares/adminGuard.js";
import {
  listarCorrecoesNascimento,
  aprovarCorrecaoNascimento,
  recusarCorrecaoNascimento,
} from "../controllers/adminCorrecaoNascimentoController.js";
import {
  baixarDocumentoNascimentoAdmin,
} from "../controllers/documentosNascimentoController.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get(
  "/",
  listarCorrecoesNascimento
);

router.get(
  "/:id/documento",
  requireSuperAdmin,
  baixarDocumentoNascimentoAdmin
);

router.post(
  "/:id/aprovar",
  requireSuperAdmin,
  aprovarCorrecaoNascimento
);

router.post(
  "/:id/recusar",
  requireSuperAdmin,
  recusarCorrecaoNascimento
);

export default router;