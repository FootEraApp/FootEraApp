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
  criarAvaliacaoMetodologia,
  concluirItemMetodologia,
} from "../controllers/metodologiasController.js";
import { requireMetodologiaCreator } from "../middlewares/requireMetodologiaCreator.js";

const router = Router();

// ✅ ROTAS ESPECÍFICAS PRIMEIRO (antes do "/:id")
router.get("/minhas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/criadas", authenticateToken, listMinhasMetodologiasCriadas);
// ✅ esse é o “catálogo / todos visíveis”, vai para Treinos-Instrutores
router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);
// ✅ se você quer manter "/assinadas", faça ela apontar para "/minhas"
router.get("/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.post("/avaliacoes", authenticateToken, criarAvaliacaoMetodologia);
// itens
router.post("/:metodologiaId/itens", authenticateToken, createMetodologiaItens);
router.delete("/:metodologiaId/itens", authenticateToken, deleteMetodologiaItens);
// detalhe/assinatura
router.get("/:id/detalhe", authenticateToken, getMetodologiaDetalhe);
router.post("/:id/assinar", authenticateToken, assinarMetodologia);
router.post("/:id/concluir-item", authenticateToken, concluirItemMetodologia);
// por id (sempre por último!)
router.get("/:id", authenticateToken, getMetodologiaById);
router.put("/:id", authenticateToken, requireMetodologiaCreator, updateMetodologia);
router.delete("/:id", authenticateToken, requireMetodologiaCreator, deleteMetodologia);
// CRUD
router.get("/", authenticateToken, listMetodologias);
router.post("/", authenticateToken, requireMetodologiaCreator, createMetodologia);

export default router;