import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarObservados,
  pararDeObservar,
} from "../controllers/atletaObservadoController.js";

const router = Router();

router.get("/", authenticateToken, listarObservados);
router.delete("/:atletaId", authenticateToken, pararDeObservar);

export default router;