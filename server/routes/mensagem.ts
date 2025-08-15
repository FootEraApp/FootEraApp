import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  enviarMensagem,
  buscarMensagens
} from "../controllers/mensagensController.js";

const router = Router();

router.post("/", authenticateToken, enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);

export default router;