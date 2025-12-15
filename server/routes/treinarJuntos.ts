import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { treinarJuntosController } from "../controllers/treinarJuntosController.js";

const router = Router();

router.use(authenticateToken);

router.get(
  "/status/:perfilUsuarioId",
  treinarJuntosController.status
);

export default router;