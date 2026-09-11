import {
  Router,
} from "express";

import {
  authenticateToken,
} from "../middlewares/auth.js";

import {
  getTreinoUnico,
  getTreinoProgramadoPublico,
} from "../controllers/TreinoUnicoController.js";

const router =
  Router();

router.get(
  "/publico/:id",
  getTreinoProgramadoPublico
);

router.get(
  "/",
  authenticateToken,
  getTreinoUnico
);

export default router;