import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  uploadExercicioMidia,
  criarExercicio,
  editarExercicio,
  excluirExercicio,
  listarExercicios,
  listarMeusExercicios,
  buscarExercicioPorId,
  duplicarExercicio,
  favoritarExercicio,
} from "../controllers/exerciciosController.js";

const router = express.Router();

router.get("/meus", authenticateToken, listarMeusExercicios);
router.get("/:id", authenticateToken, buscarExercicioPorId);

router.put("/:id", authenticateToken, uploadExercicioMidia, editarExercicio);
router.delete("/:id", authenticateToken, excluirExercicio);

router.post("/:id/duplicar", authenticateToken, duplicarExercicio);
router.patch("/:id/favoritar", authenticateToken, favoritarExercicio);
router.get("/", listarExercicios);
router.post("/", authenticateToken, uploadExercicioMidia, criarExercicio);

export default router;