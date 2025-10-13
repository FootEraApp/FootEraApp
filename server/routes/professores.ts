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
} from "../controllers/professoresController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ dest: "upload/" });

/** Vinculação institucional do professor (compatível com teu front) */
router.put("/:id/vinculos", authenticateToken, salvarVinculoProfessor);

/** (Opcional) rota antiga que você tinha como POST singular — mantida por compatibilidade */
router.post("/:id/vinculo", authenticateToken, salvarVinculoProfessor);

/** Consulta vínculos atuais (escolinha/clube) */
router.get("/:id/vinculos", authenticateToken, listarVinculosProfessor);

/** CRUD padrão */
router.get("/:id", buscarProfessorPorId);
router.post("/", upload.single("fotoUrl"), criarProfessor);
router.patch("/:id", upload.single("fotoUrl"), editarProfessor);
router.put("/:id", upload.single("fotoUrl"), editarProfessor);
router.delete("/:id", excluirProfessor);
router.get("/", listarProfessores);

export default router;
