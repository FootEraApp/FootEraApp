// server/routes/learningEventosRoutes.ts
import { Router } from "express";
import {
  getSalaCopaPublica,
  inscreverSalaCopa,
  comprarSalaCopa,
  getAulaEventoPublica,
  inscreverAulaEvento,
  comprarAulaEvento,
} from "../controllers/learningEventosController.js";

const router = Router();

router.get("/aulas/:aulaId", getAulaEventoPublica);
router.post("/aulas/:aulaId/inscrever", inscreverAulaEvento);
router.post("/aulas/:aulaId/comprar", comprarAulaEvento);
router.get("/sala-copa", getSalaCopaPublica);
router.post("/sala-copa/inscrever", inscreverSalaCopa);
router.post("/sala-copa/comprar", comprarSalaCopa);

export default router;