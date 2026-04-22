// server/routes/metodologiasRoutes.ts
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
  createMetodologiaCompleta,
  createMetodologiaAvulsaCompleta,
  createMetodologiaAvulsa,
  getMetodologiaAvulsaById,
  updateMetodologiaAvulsa,
  deleteMetodologiaAvulsa,
  migrarMetodologiaAvulsaParaLearning,
  migrarMetodologiaParaAvulsa,
  criarSubmissaoMetodologiaItem,
} from "../controllers/metodologiasController.js";
import { uploadMetodologiaS3 } from "../controllers/metodologiasUploadController.js";
import { uploadToS3 } from "../middlewares/s3Upload.js";
import {
  requireMetodologiaCreateAccess,
  requireMetodologiaOwnership,
} from "../middlewares/requireMetodologiaCreator.js";

const router = Router();

router.post(
  "/upload-s3",
  authenticateToken,
  uploadToS3.single("file"),
  uploadMetodologiaS3
);

// específicas
router.get("/minhas", authenticateToken, listMinhasMetodologiasAssinadas);
router.get("/criadas", authenticateToken, listMinhasMetodologiasCriadas);
router.get("/visiveis", authenticateToken, listMetodologiasVisiveis);
router.get("/assinadas", authenticateToken, listMinhasMetodologiasAssinadas);
router.post("/avaliacoes", authenticateToken, criarAvaliacaoMetodologia);

// criação completa normal
router.post(
  "/completa",
  authenticateToken,
  requireMetodologiaCreateAccess,
  createMetodologiaCompleta
);

// AVULSAS — ANTES DAS ROTAS /:id
router.post(
  "/metodologias-avulsas/completa",
  authenticateToken,
  requireMetodologiaCreateAccess,
  createMetodologiaAvulsaCompleta
);
router.post(
  "/metodologias-avulsas",
  authenticateToken,
  requireMetodologiaCreateAccess,
  createMetodologiaAvulsa
);
router.get("/metodologias-avulsas/:id", authenticateToken, getMetodologiaAvulsaById);
router.put(
  "/metodologias-avulsas/:id",
  authenticateToken,
  updateMetodologiaAvulsa
);
router.delete(
  "/metodologias-avulsas/:id",
  authenticateToken,
  deleteMetodologiaAvulsa
);

// legado
router.post("/:metodologiaId/itens", authenticateToken, createMetodologiaItens);
router.delete("/:metodologiaId/itens", authenticateToken, deleteMetodologiaItens);

// estruturas
router.post("/:metodologiaId/estruturas", authenticateToken, requireMetodologiaOwnership, createMetodologiaEstruturas);
router.put("/:metodologiaId/estruturas/:estruturaId", authenticateToken, requireMetodologiaOwnership, updateMetodologiaEstrutura);
router.delete("/:metodologiaId/estruturas/:estruturaId", authenticateToken, requireMetodologiaOwnership, deleteMetodologiaEstrutura);
router.post("/:metodologiaId/estruturas/:estruturaId/itens", authenticateToken, requireMetodologiaOwnership, createMetodologiaEstruturaItens);
router.delete("/:metodologiaId/estruturas/:estruturaId/itens", authenticateToken, requireMetodologiaOwnership, deleteMetodologiaEstruturaItens);
router.post(
  "/:id/estruturas/:estruturaId/submissoes",
  authenticateToken,
  uploadToS3.single("file"),
  criarSubmissaoMetodologiaItem
);
router.post(
  "/metodologias-avulsas/:id/estruturas/:estruturaId/submissoes",
  authenticateToken,
  uploadToS3.single("file"),
  criarSubmissaoMetodologiaItem
);

router.post(
  "/metodologias-avulsas/:id/estruturas/:estruturaId/concluir-item",
  authenticateToken,
  concluirEstruturaItemMetodologia
);
router.post(
  "/:id/estruturas/:estruturaId/concluir-item",
  authenticateToken,
  concluirEstruturaItemMetodologia
);
router.post(
  "/:id/migrar-para-avulsa",
  authenticateToken,
  migrarMetodologiaParaAvulsa
);

router.post(
  "/metodologias-avulsas/:id/migrar-para-learning",
  authenticateToken,
  migrarMetodologiaAvulsaParaLearning
);

// detalhe/assinatura
router.get("/:id/detalhe", authenticateToken, getMetodologiaDetalhe);
router.post("/:id/assinar", authenticateToken, assinarMetodologia);
router.post("/:id/concluir-item", authenticateToken, concluirItemMetodologia);
router.post("/metodologias-avulsas/:id/concluir-item", authenticateToken, concluirItemMetodologia);

// por id por último
router.get("/:id", authenticateToken, getMetodologiaById);
router.put("/:id", authenticateToken, requireMetodologiaOwnership, updateMetodologia);
router.delete("/:id", authenticateToken, requireMetodologiaOwnership, deleteMetodologia);

// CRUD padrão
router.get("/", authenticateToken, listMetodologias);
router.post("/", authenticateToken, requireMetodologiaCreateAccess, createMetodologia);

export default router;