import { Router } from "express";
import {
  getMensagens,
  enviarMensagem,
  getCaixasDeMensagens
} from "../controllers/mensagensController";
import { authenticateToken as authenticate} from "../middlewares/auth"; 

const router = Router();

router.use(authenticate); 

router.get("/caixa", getCaixasDeMensagens);
router.get("/:destinatarioId", getMensagens);
router.post("/:destinatarioId", enviarMensagem);

export default router;
