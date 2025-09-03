// server/routes/observadosRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarObservados,
  observarAtleta,
  pararDeObservar,
} from "../controllers/atletaObservadoController.js";

const router = Router();

// GET    /api/observados                -> lista (pode usar ?tipoUsuarioId=xxx)
// POST   /api/observados                -> observar atleta (body: { atletaId | atletaUsuarioId })
// DELETE /api/observados/:atletaId      -> parar de observar
router.get("/", authenticateToken, listarObservados);
router.post("/", authenticateToken, observarAtleta);
router.delete("/:atletaId", authenticateToken, pararDeObservar);

export default router;
