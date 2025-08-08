import { Router } from "express";
import { authenticateToken } from "../middlewares/auth";
import {
  enviarMensagem,
  buscarMensagens
} from "../controllers/mensagensController";

const router = Router();

router.post("/", authenticateToken, enviarMensagem);
router.get("/", authenticateToken, buscarMensagens);

export default router;