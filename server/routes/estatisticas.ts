import { Router } from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import { rebuildEstatisticaExercicios } from "../controllers/estatisticaExercicioController.js";

const r = Router();

r.post("/exercicios/rebuild", authenticateToken, rebuildEstatisticaExercicios);

export default r;