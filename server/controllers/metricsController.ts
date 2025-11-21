import type { Request, Response } from "express";
import { getObservabilitySnapshot } from "../services/observability.js";

export function getMetrics(req: Request, res: Response) {
  try {
    const snapshot = getObservabilitySnapshot();
    return res.json(snapshot);
  } catch (err) {
    console.error("Erro ao obter métricas de observabilidade:", err);
    return res.status(500).json({ message: "Erro ao obter métricas." });
  }
}