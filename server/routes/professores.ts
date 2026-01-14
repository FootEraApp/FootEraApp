// server/routes/professores
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
  listarProfessoresVinculados
} from "../controllers/professoresController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ dest: "upload/" });

router.get("/vinculados", authenticateToken, listarProfessoresVinculados);
router.get("/:professorId/atletas", listarAtletasDoProfessor);
router.get("/:professorId/historico-atletas", listarHistoricoAtletasProfessor);
router.post("/:professorId/desvincular-atleta", desvincularAtletaDoProfessor);
router.put("/:id/vinculos", authenticateToken, salvarVinculoProfessor);
router.post("/:id/vinculo", authenticateToken, salvarVinculoProfessor);
router.get("/:id/vinculos", authenticateToken, listarVinculosProfessor);
router.get("/:id", buscarProfessorPorId);
router.post("/", upload.single("fotoUrl"), criarProfessor);
router.patch("/:id", upload.single("fotoUrl"), editarProfessor);
router.put("/:id", upload.single("fotoUrl"), editarProfessor);
router.delete("/:id", excluirProfessor);
router.get("/", listarProfessores);

export default router;