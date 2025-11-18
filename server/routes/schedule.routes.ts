import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireCapability } from "server/middlewares/guards.js";
import * as controller from "../controllers/schedule.controller.js";

const router = Router();

router.post(
  "/personal",
  authenticateToken,
  requireCapability("agendamento:pessoal"),
  controller.createPersonalSchedule
);

export default router;