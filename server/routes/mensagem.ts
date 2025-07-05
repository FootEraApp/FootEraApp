// server/routes/mensagem.routes.ts
import { Router } from "express";
import {
  getMensagens,
  enviarMensagem,
  getCaixasDeMensagens
} from "../controllers/mensagensController";
import { authenticateToken as authenticate} from "../middlewares/auth"; // middleware que define req.userId

const router = Router();

router.use(authenticate); // Protege todas as rotas

router.get("/caixa", getCaixasDeMensagens);
router.get("/:destinatarioId", getMensagens);
router.post("/:destinatarioId", enviarMensagem);

export default router;
