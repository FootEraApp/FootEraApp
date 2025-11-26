import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  criarEvento,
  obterEvento,
  atualizarPartida,
  reSeedEvento,
} from "../controllers/jogosElencoController.js";

const router = express.Router();

router.get("/eventos/:id", authenticateToken, obterEvento);
router.post("/eventos/:id/reseed", authenticateToken, reSeedEvento);
router.patch("/partidas/:id", authenticateToken, atualizarPartida);
router.post("/eventos", authenticateToken, criarEvento);

export default router;