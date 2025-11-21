import { Router } from "express";
import { getMetrics } from "../controllers/metricsController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/metrics", authenticateToken, getMetrics);

export default router;