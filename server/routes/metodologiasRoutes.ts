import { Router } from "express";
import {
  listMetodologias,
  getMetodologiaById,
  createMetodologia,
  updateMetodologia,
  deleteMetodologia,
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
  listMetodologiasVisiveis
} from "../controllers/metodologiasController.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);
router.get("/minhas/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/minhas", authenticateToken, listMinhasMetodologiasCriadas); // ✅ NOVO
router.get("/:id", getMetodologiaById);
router.get("/", listMetodologias);
router.post("/", authenticateToken, createMetodologia);
router.put("/:id", authenticateToken, updateMetodologia);
router.delete("/:id", authenticateToken, deleteMetodologia);

export default router;
