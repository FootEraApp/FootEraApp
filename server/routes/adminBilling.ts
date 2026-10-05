import express from "express";
import { processarRenovacoesDiarias } from "../services/billingscheduler.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/guards.js";

const router = express.Router();

router.post("/billing/run-daily", authenticateToken, requireAdmin, async (req, res) => {
  await processarRenovacoesDiarias();
  res.json({ ok: true });
});

export default router;