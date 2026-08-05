import {
  Router,
} from "express";

import {
  getSalaCopaPublica,
  inscreverSalaCopa,
  comprarSalaCopa,
  getAulaEventoPublica,
  inscreverAulaEvento,
  comprarAulaEvento,
  listarMinhasAulasLearning,
} from "../controllers/learningEventosController.js";

import {
  authenticateToken,
} from "../middlewares/auth.js";

const router = Router();

router.get(
  "/minhas-aulas",
  authenticateToken,
  listarMinhasAulasLearning
);

router.get(
  "/aulas/:aulaId",
  getAulaEventoPublica
);

router.post(
  "/aulas/:aulaId/inscrever",
  inscreverAulaEvento
);

router.post(
  "/aulas/:aulaId/comprar",
  comprarAulaEvento
);

router.get(
  "/sala-copa",
  getSalaCopaPublica
);

router.post(
  "/sala-copa/inscrever",
  inscreverSalaCopa
);

router.post(
  "/sala-copa/comprar",
  comprarSalaCopa
);

export default router;