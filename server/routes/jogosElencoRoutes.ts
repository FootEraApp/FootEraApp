// server/routes/jogosElencoRoutes.ts
import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarEvento,
  obterEvento,
  atualizarPartida,
  reSeedEvento,
} from "../controllers/jogosElencoController.js";

const router = express.Router();

router.post("/eventos", authenticateToken, criarEvento);
router.get("/eventos/:id", authenticateToken, obterEvento);

// Permite reordenar seeds ANTES de iniciar alguma partida
router.post("/eventos/:id/reseed", authenticateToken, reSeedEvento);

// Controles de partida (start, finish, score, foul, advance)
router.patch("/partidas/:id", authenticateToken, atualizarPartida);

export default router;
