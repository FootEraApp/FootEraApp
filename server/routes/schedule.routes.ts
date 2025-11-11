// server/src/routes/schedule.routes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requirePro } from "../middlewares/requirePro.js";
import * as controller from "../controllers/schedule.controller.js";

const router = Router();

router.post(
  "/personal",
  authenticateToken,
  requirePro("Agendamento pessoal"),
  controller.createPersonalSchedule
);

export default router;
