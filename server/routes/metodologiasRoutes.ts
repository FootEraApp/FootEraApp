// server/routes/metodologiasRoutes
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
  createMetodologiaEstruturas,
  updateMetodologiaEstrutura,
  deleteMetodologiaEstrutura,
  createMetodologiaEstruturaItens,
  deleteMetodologiaEstruturaItens,
  concluirEstruturaItemMetodologia,
} from "../controllers/metodologiasController.js";
import { uploadMetodologiaS3 } from "../controllers/metodologiasUploadController.js"; // Controller de upload
import { uploadToS3 } from "../middlewares/s3Upload.js"; // Middleware que editamos
import { requireMetodologiaCreator } from "../middlewares/requireMetodologiaCreator.js";

const router = Router();

// --- NOVAS ROTAS DE UPLOAD S3 ---
// Esta rota garante que o req.originalUrl contenha "metodologias" para a lógica de pastas no S3
router.post(
  "/upload-s3",
  authenticateToken,
  uploadToS3.single("file"),
  uploadMetodologiaS3
);

// --- ROTAS ESPECÍFICAS ---
router.get("/minhas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/criadas", authenticateToken, listMinhasMetodologiasCriadas);
router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);
router.get("/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.post("/avaliacoes", authenticateToken, criarAvaliacaoMetodologia);

// LEGADO - manter temporariamente enquanto o front antigo ainda existir
router.post("/:metodologiaId/itens", authenticateToken, createMetodologiaItens);
router.delete("/:metodologiaId/itens", authenticateToken, deleteMetodologiaItens);

// Estruturas: trilhas / módulos
router.post("/:metodologiaId/estruturas", authenticateToken, requireMetodologiaCreator, createMetodologiaEstruturas);
router.put("/:metodologiaId/estruturas/:estruturaId", authenticateToken, requireMetodologiaCreator, updateMetodologiaEstrutura);
router.delete("/:metodologiaId/estruturas/:estruturaId", authenticateToken, requireMetodologiaCreator, deleteMetodologiaEstrutura);
// Itens dentro da estrutura
router.post("/:metodologiaId/estruturas/:estruturaId/itens", authenticateToken, requireMetodologiaCreator, createMetodologiaEstruturaItens);
router.delete("/:metodologiaId/estruturas/:estruturaId/itens", authenticateToken, requireMetodologiaCreator, deleteMetodologiaEstruturaItens);
// Conclusão de item da estrutura
router.post("/:id/estruturas/:estruturaId/concluir-item", authenticateToken, concluirEstruturaItemMetodologia);

// Detalhe/Assinatura
router.get("/:id/detalhe", authenticateToken, getMetodologiaDetalhe);
router.post("/:id/assinar", authenticateToken, assinarMetodologia);
router.post("/:id/concluir-item", authenticateToken, concluirItemMetodologia);

// Por ID (Sempre por último)
router.get("/:id", authenticateToken, getMetodologiaById);
router.put("/:id", authenticateToken, requireMetodologiaCreator, updateMetodologia);
router.delete("/:id", authenticateToken, requireMetodologiaCreator, deleteMetodologia);

// CRUD Geral
router.get("/", authenticateToken, listMetodologias);
router.post("/", authenticateToken, requireMetodologiaCreator, createMetodologia);

export default router;