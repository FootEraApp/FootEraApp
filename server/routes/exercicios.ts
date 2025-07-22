import express from "express";
import { criarExercicio, editarExercicio, excluirExercicio, listarExercicios, buscarExercicioPorId } from "../controllers/exerciciosController";

const router = express.Router();

router.get("/", listarExercicios);
router.get("/:id", buscarExercicioPorId);
router.post("/", criarExercicio);
router.put("/:id", editarExercicio);
router.delete("/:id", excluirExercicio);

export default router;
