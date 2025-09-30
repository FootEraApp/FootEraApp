import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { listarTemplates, criarTemplate, salvarChecklistSubTreino } from "../controllers/checklistController.js";

const r = Router();

r.get("/templates", authenticateToken, listarTemplates);
r.post("/templates", authenticateToken, criarTemplate);
r.post("/submissoes-treino/:submissaoTreinoId/respostas",
  authenticateToken,
  salvarChecklistSubTreino
);

export default r;