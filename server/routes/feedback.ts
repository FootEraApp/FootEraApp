import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/feedbackController.js";
import {
  requireAdmin,
} from "../middlewares/guards.js";

const r = Router();

r.post("/blocked", ctrl.createBlockedSupport);
r.post(
  "/",
  authenticateToken,
  ctrl.create
);

r.get(
  "/me",
  authenticateToken,
  ctrl.listMine
);

r.get(
  "/",
  authenticateToken,
  requireAdmin,
  ctrl.listAll
);

r.patch(
  "/:id/lido",
  authenticateToken,
  requireAdmin,
  ctrl.marcarComoLido
);
export default r;