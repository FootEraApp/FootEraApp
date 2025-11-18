// server/routes/metricsRoutes.ts
import { Router } from "express";
import { getMetrics } from "../controllers/metricsController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// Exemplo: somente usuários autenticados (você pode filtrar por admin dentro do controller)
router.get("/metrics", authenticateToken, getMetrics);

export default router;