// server/routes/professores.ts
import express from "express";
import multer from "multer";
import {
  criarProfessor,
  editarProfessor,
  excluirProfessor,
  listarProfessores,
  buscarProfessorPorId,
  listarVinculosProfessor,
  salvarVinculoProfessor,
  listarHistoricoAtletasProfessor,
  desvincularAtletaDoProfessor,
  listarAtletasDoProfessor,
  listarProfessoresVinculados,
  toggleProfessorParceiro,
} from "../controllers/professoresController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/adminGuard.js";

const router = express.Router();
const upload = multer({ dest: "upload/" });

/**
 * =========================
 * Rotas especiais / listas
 * =========================
 */

// lista professores vinculados (clube/escolinha)
router.get("/vinculados", authenticateToken, listarProfessoresVinculados);

// marcar / desmarcar professor como parceiro FootEra (ADMIN)
router.patch(
  "/:id/parceiro",
  authenticateToken,
  requireAdmin,
  toggleProfessorParceiro
);

/**
 * =========================
 * Atletas do professor
 * =========================
 */

// listar atletas do professor
router.get("/:professorId/atletas", authenticateToken, listarAtletasDoProfessor);

// histórico de atletas do professor
router.get(
  "/:professorId/historico-atletas",
  authenticateToken,
  listarHistoricoAtletasProfessor
);

// desvincular atleta do professor
router.post(
  "/:professorId/desvincular-atleta",
  authenticateToken,
  desvincularAtletaDoProfessor
);

router.get("/:id/vinculos", authenticateToken, listarVinculosProfessor);
router.post("/:id/vinculo", authenticateToken, salvarVinculoProfessor);
router.put("/:id/vinculos", authenticateToken, salvarVinculoProfessor);
router.get("/:id", authenticateToken, buscarProfessorPorId);

router.post(
  "/",
  authenticateToken,
  requireAdmin,
  upload.single("fotoUrl"),
  criarProfessor
);

router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  upload.single("fotoUrl"),
  editarProfessor
);
router.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  upload.single("fotoUrl"),
  editarProfessor
);

router.delete("/:id", authenticateToken, requireAdmin, excluirProfessor);
router.get("/", authenticateToken, listarProfessores);

export default router;