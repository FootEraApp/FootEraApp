import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getPrivacidade,
  patchPrivacidade,
  getNotificacoes,
  patchNotificacoes,
  trocarSenha,
  encerrarSessoes,
  getGoogleStatus,
  unlinkGoogle,
  getPrivacidadeAtletaGerenciado,
  patchPrivacidadeAtletaGerenciado, 
} from "../controllers/configuracoesPerfilController.js";
const r = Router();

r.get("/privacidade", authenticateToken, getPrivacidade);
r.patch("/privacidade", authenticateToken, patchPrivacidade);
r.get(
  "/privacidade/atletas/:atletaId",
  authenticateToken,
  getPrivacidadeAtletaGerenciado
);
r.patch(
  "/privacidade/atletas/:atletaId",
  authenticateToken,
  patchPrivacidadeAtletaGerenciado
);
r.get("/notificacoes", authenticateToken, getNotificacoes);
r.patch("/notificacoes", authenticateToken, patchNotificacoes);
r.put("/seguranca/senha", authenticateToken, trocarSenha);
r.post("/seguranca/encerrar-sessoes", authenticateToken, encerrarSessoes);
r.get("/seguranca/google", authenticateToken, getGoogleStatus);
r.delete("/seguranca/google", authenticateToken, unlinkGoogle);

export default r;