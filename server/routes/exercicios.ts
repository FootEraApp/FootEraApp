import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  uploadVideo,
  criarExercicio,
  editarExercicio,
  excluirExercicio,
  listarExercicios,
  buscarExercicioPorId,
} from "../controllers/exerciciosController.js";

const router = express.Router();

router.get("/:id", buscarExercicioPorId);
router.get("/", listarExercicios);
router.post("/", authenticateToken, uploadVideo, criarExercicio);
router.put("/:id", authenticateToken, uploadVideo, editarExercicio);
router.delete("/:id", authenticateToken, excluirExercicio);

export default router;