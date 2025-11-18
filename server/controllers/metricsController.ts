// server/controllers/metricsController.ts
import type { Request, Response } from "express";
import { getObservabilitySnapshot } from "../services/observability.js";

/**
 * GET /api/admin/metrics
 * Retorna um snapshot simples das métricas de capabilities:
 *  - caps: allowed/denied por capability
 *  - canStats: latência média e máxima do can() por capability
 */
export function getMetrics(req: Request, res: Response) {
  try {
    // se quiser restringir a admin, pode checar aqui:
    // const user = (req as any).user;
    // if (!user || user.tipo !== "Admin") return res.status(403).json({ message: "Forbidden" });

    const snapshot = getObservabilitySnapshot();
    return res.json(snapshot);
  } catch (err) {
    console.error("Erro ao obter métricas de observabilidade:", err);
    return res.status(500).json({ message: "Erro ao obter métricas." });
  }
}