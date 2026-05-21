import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { uploadToS3 } from "../middlewares/s3Upload.js"; // ✅ Nosso middleware S3
import {
  criarExercicio,
  editarExercicio,
  excluirExercicio,
  listarExercicios,
  listarMeusExercicios,
  buscarExercicioPorId,
  duplicarExercicio,
  favoritarExercicio,
  criarExercicioPersonalizado,
} from "../controllers/exerciciosController.js";

const router = express.Router();

router.get("/meus", authenticateToken, listarMeusExercicios);
router.get("/:id", authenticateToken, buscarExercicioPorId);

// ✅ Usando uploadToS3.single("video")
router.put("/:id", authenticateToken, uploadToS3.single("video"), editarExercicio);
router.delete("/:id", authenticateToken, excluirExercicio);

router.post("/:id/duplicar", authenticateToken, duplicarExercicio);
router.patch("/:id/favoritar", authenticateToken, favoritarExercicio);
router.get("/", listarExercicios);
router.post(
  "/personalizados",
  authenticateToken,
  uploadToS3.single("video"),
  criarExercicioPersonalizado
);
// ✅ Usando uploadToS3.single("video")
router.post("/", authenticateToken, uploadToS3.single("video"), criarExercicio);

export default router;