import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  listModeracaoDesafios,
  aprovarSubmissaoDesafio,
  invalidarSubmissaoDesafio,
} from "../controllers/adminModeracaoController.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/desafios", listModeracaoDesafios);
router.post("/desafios/:id/aprovar", aprovarSubmissaoDesafio);
router.post("/desafios/:id/invalidar", invalidarSubmissaoDesafio);

export default router;