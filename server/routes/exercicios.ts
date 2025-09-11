import express from "express";
import {uploadVideo, criarExercicio, editarExercicio, excluirExercicio, listarExercicios, buscarExercicioPorId } from "../controllers/exerciciosController.js";

const router = express.Router();

router.get("/:id", buscarExercicioPorId);
router.get("/", listarExercicios);
router.post("/", uploadVideo, criarExercicio);
router.put("/:id", uploadVideo, editarExercicio);
router.delete("/:id", excluirExercicio);

export default router;