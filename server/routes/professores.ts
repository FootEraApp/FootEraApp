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

router.get("/vinculados", authenticateToken, listarProfessoresVinculados);
router.patch(
  "/:id/parceiro",
  authenticateToken,
  requireAdmin,
  toggleProfessorParceiro
);

router.get("/:professorId/atletas", authenticateToken, listarAtletasDoProfessor);
router.get(
  "/:professorId/historico-atletas",
  authenticateToken,
  listarHistoricoAtletasProfessor
);
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