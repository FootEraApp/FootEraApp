import { Router } from "express";
import { getTopExercicios, getTreinoStats } from "../controllers/analyticsController.js";
const r = Router();

r.get("/analytics/exercicios/top", getTopExercicios);
r.get("/analytics/treinos/:id", getTreinoStats);

export default r;