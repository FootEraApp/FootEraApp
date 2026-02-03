import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  getPrivacidade,
  patchPrivacidade,
  getNotificacoes,
  patchNotificacoes,
  trocarSenha,
  encerrarSessoes,
} from "../controllers/configuracoesPerfilController.js";

const r = Router();

r.get("/privacidade", authenticateToken, getPrivacidade);
r.patch("/privacidade", authenticateToken, patchPrivacidade);
r.get("/notificacoes", authenticateToken, getNotificacoes);
r.patch("/notificacoes", authenticateToken, patchNotificacoes);
r.put("/seguranca/senha", authenticateToken, trocarSenha);
r.post("/seguranca/encerrar-sessoes", authenticateToken, encerrarSessoes);

export default r;