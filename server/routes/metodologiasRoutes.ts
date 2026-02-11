// server/routes/metodologiasRoutes
import { Router } from "express";
import {
  listMetodologias,
  getMetodologiaById,
  createMetodologia,
  updateMetodologia,
  deleteMetodologia,
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
  listMetodologiasVisiveis,
  createMetodologiaItens,
  getMetodologiaDetalhe,
  assinarMetodologia,
  deleteMetodologiaItens,
} from "../controllers/metodologiasController.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);
router.get("/minhas/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/minhas", authenticateToken, listMinhasMetodologiasCriadas);

// revisar ===================
router.get("/criadas", authenticateToken, listMinhasMetodologiasCriadas);
router.get("/minhas-criadas", authenticateToken, listMinhasMetodologiasCriadas);
router.get("/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/:id/detalhe", authenticateToken, getMetodologiaDetalhe);
router.post("/:id/assinar", authenticateToken, assinarMetodologia);
// ==========================

router.post("/:metodologiaId/itens", authenticateToken, createMetodologiaItens);
router.delete("/:metodologiaId/itens", authenticateToken, deleteMetodologiaItens);
router.get("/:id", getMetodologiaById);
router.get("/", listMetodologias);
router.post("/", authenticateToken, createMetodologia);
router.put("/:id", authenticateToken, updateMetodologia);
router.delete("/:id", authenticateToken, deleteMetodologia);

export default router;