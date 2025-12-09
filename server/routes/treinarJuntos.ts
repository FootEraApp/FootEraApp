// server/routes/treinarJuntos.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { treinarJuntosController } from "../controllers/treinarJuntosController.js";

const router = Router();

router.use(authenticateToken);

// a URL final vai ficar /api/treinar-juntos/status/:perfilUsuarioId
// (dependendo do prefixo que você usa no index.ts)
router.get(
  "/status/:perfilUsuarioId",
  treinarJuntosController.status
);

export default router;
