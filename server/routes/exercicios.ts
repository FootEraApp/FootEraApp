import express from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { uploadToS3 } from "../middlewares/s3Upload.js"; 
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
  listarExerciciosAdmin,
} from "../controllers/exerciciosController.js";

const router = express.Router();

router.get("/meus", authenticateToken, listarMeusExercicios);
router.get(
  "/admin/todos",
  authenticateToken,
  listarExerciciosAdmin
);
router.get("/:id", authenticateToken, buscarExercicioPorId);
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
router.post("/", authenticateToken, uploadToS3.single("video"), criarExercicio);

export default router;