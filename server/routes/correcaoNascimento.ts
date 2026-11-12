import { Router } from "express";
import {
  authenticateToken,
} from "../middlewares/auth.js";
import {
  criarMinhaSolicitacaoCorrecaoNascimento,
  listarMinhasSolicitacoesCorrecaoNascimento,
  consultarDisponibilidadeDocumentoNascimento
} from "../controllers/correcaoNascimentoController.js";
import {
  exigirUploadNascimentoAtivo,
  receberDocumentoNascimento,
  enviarDocumentoNascimento,
} from "../controllers/documentosNascimentoController.js";

const router = Router();

router.use(authenticateToken);

router.get(
  "/disponibilidade-documento",
  consultarDisponibilidadeDocumentoNascimento
);

router.post(
  "/solicitar",
  criarMinhaSolicitacaoCorrecaoNascimento
);

router.get(
  "/minha",
  listarMinhasSolicitacoesCorrecaoNascimento
);

router.post(
  "/:id/documento",
  exigirUploadNascimentoAtivo,
  receberDocumentoNascimento,
  enviarDocumentoNascimento
);

export default router;