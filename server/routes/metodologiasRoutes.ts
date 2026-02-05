import { Router } from "express";
import {
  listMetodologias,
  getMetodologiaById,
  createMetodologia,
  updateMetodologia,
  deleteMetodologia,
  listMinhasMetodologiasAssinadas,
} from "../controllers/metodologiasController.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// público
router.get("/", listMetodologias);

// ✅ precisa vir ANTES de "/:id"
router.get("/minhas/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);

// público
router.get("/:id", getMetodologiaById);

// CRUD (precisa auth)
router.post("/", authenticateToken, createMetodologia);
router.put("/:id", authenticateToken, updateMetodologia);
router.delete("/:id", authenticateToken, deleteMetodologia);

export default router;
