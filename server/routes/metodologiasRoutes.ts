import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
  listMetodologiasVisiveis,
  assinarMetodologia,
  createMetodologia,
  updateMetodologia,
  deleteMetodologia,
  createMetodologiaItens,
  deleteMetodologiaItens,
  getMetodologiaDetalhe,
  getMetodologiaById,
  listMetodologias,
} from "../controllers/metodologiasController.js";

const router = Router();

// ✅ ROTAS ESPECÍFICAS PRIMEIRO (antes do "/:id")
router.get("/minhas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/criadas", authenticateToken, listMinhasMetodologiasCriadas);

// ✅ esse é o “catálogo / todos visíveis”, vai para Treinos-Instrutores
router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);

// ✅ se você quer manter "/assinadas", faça ela apontar para "/minhas"
router.get("/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);

// itens
router.post("/:metodologiaId/itens", authenticateToken, createMetodologiaItens);
router.delete("/:metodologiaId/itens", authenticateToken, deleteMetodologiaItens);

// detalhe/assinatura
router.get("/:id/detalhe", authenticateToken, getMetodologiaDetalhe);
router.post("/:id/assinar", authenticateToken, assinarMetodologia);

// por id (sempre por último!)
router.get("/:id", authenticateToken, getMetodologiaById);
router.put("/:id", authenticateToken, updateMetodologia);
router.delete("/:id", authenticateToken, deleteMetodologia);

// CRUD
router.get("/", authenticateToken, listMetodologias);
router.post("/", authenticateToken, createMetodologia);

export default router;