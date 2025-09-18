import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarObservados,
  observarAtleta, 
  pararDeObservar,
} from "../controllers/atletaObservadoController.js";

const router = Router();

router.get("/", authenticateToken, listarObservados);
router.post("/", authenticateToken, observarAtleta); 
router.delete("/:atletaId", authenticateToken, pararDeObservar);

export default router;