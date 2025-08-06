import express from "express";
import {uploadVideo, criarExercicio, editarExercicio, excluirExercicio, listarExercicios, buscarExercicioPorId } from "../controllers/exerciciosController";

const router = express.Router();

router.get("/", listarExercicios);
router.get("/:id", buscarExercicioPorId);
router.post("/", uploadVideo, criarExercicio);
router.put("/:id", uploadVideo, editarExercicio);
router.delete("/:id", excluirExercicio);

export default router;
