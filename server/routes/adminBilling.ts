import express from "express";
import { processarRenovacoesDiarias } from "../services/billingscheduler.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

router.post("/billing/run-daily", requireAdmin, async (req, res) => {
  await processarRenovacoesDiarias();
  res.json({ ok: true });
});

export default router;