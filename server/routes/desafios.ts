import express from "express";
import { criarDesafio, editarDesafio, excluirDesafio, listarDesafios, buscarDesafioPorId } from "../controllers/desafiosController";

const router = express.Router();

router.get("/", listarDesafios);
router.get("/:id", buscarDesafioPorId);
router.post("/", criarDesafio);
router.put("/:id", editarDesafio);
router.delete("/:id", excluirDesafio);

export default router;
