import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  listPendentesDesafio,
  aprovarSubmissao,
  invalidarSubmissao,
} from "../controllers/moderacaoDesafioController.js";

const r = Router();
r.get("/api/admin/moderacao/desafios", requireAdmin, listPendentesDesafio);
r.post("/api/admin/moderacao/desafios/:id/aprovar", requireAdmin, aprovarSubmissao);
r.post("/api/admin/moderacao/desafios/:id/invalidar", requireAdmin, invalidarSubmissao);

export default r;