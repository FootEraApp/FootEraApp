import express from "express";
import { createDesafio, updateDesafio, deleteDesafio, getDesafios } from "../controllers/desafiosController";

const router = express.Router();
router.post("/", createDesafio);
router.put("/:id", updateDesafio);
router.delete("/:id", deleteDesafio);
router.get("/", getDesafios);

export default router;
