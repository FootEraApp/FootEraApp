import {
  Router,
} from "express";

import {
  authenticateToken,
  optionalAuthenticateToken,
} from "../middlewares/auth.js";

import {
  aceitarConvite,
  cancelarConvite,
  criarConvite,
  obterConvite,
  renovarConvite,
} from "../controllers/convitesController.js";

const router =
  Router();

router.get(
  "/:token",
  optionalAuthenticateToken,
  obterConvite
);

router.post(
  "/",
  authenticateToken,
  criarConvite
);

router.post(
  "/:token/aceitar",
  authenticateToken,
  aceitarConvite
);

router.post(
  "/:token/cancelar",
  authenticateToken,
  cancelarConvite
);

router.post(
  "/:token/renovar",
  authenticateToken,
  renovarConvite
);

export default router;