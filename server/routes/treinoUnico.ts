import {
  Router,
} from "express";

import {
  authenticateToken,
  optionalAuthenticateToken,
} from "../middlewares/auth.js";

import {
  getTreinoUnico,
  getTreinoProgramadoPublico,
} from "../controllers/TreinoUnicoController.js";

const router =
  Router();

router.get(
  "/publico/:id",
  optionalAuthenticateToken,
  getTreinoProgramadoPublico
);

router.get(
  "/",
  authenticateToken,
  getTreinoUnico
);

export default router;