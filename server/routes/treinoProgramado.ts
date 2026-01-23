// server/routes/treinosprogramados.ts
import express from "express";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/adminGuard.js";
import {
  createTreinoProgramado,
  updateTreino,
  getAllTreinos,
  getTreinoById,
  deleteTreino,
} from "../controllers/treinosProgramadosController.js";

const router = express.Router();
const upload = multer({ dest: "upload/" });

// listar
router.get("/", authenticateToken, getAllTreinos);

// buscar por id
router.get("/:id", authenticateToken, getTreinoById);

// criar (com capa)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  upload.single("imagem"), // 👈 NOME DO CAMPO DO FILE
  createTreinoProgramado
);

// editar (com capa)
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  upload.single("imagem"),
  updateTreino
);

// excluir
router.delete("/:id", authenticateToken, requireAdmin, deleteTreino);

export default router;