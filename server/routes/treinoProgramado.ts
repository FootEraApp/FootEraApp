// server/routes/treinosprogramados.ts
import express from "express";
import multer from "multer";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdminOrTreinoOwner } from "../middlewares/treinoProgramadoGuards.js";
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
  requireAdminOrTreinoOwner,
  upload.single("imagem"), // 👈 NOME DO CAMPO DO FILE
  createTreinoProgramado
);

// editar (com capa)
router.put(
  "/:id",
  authenticateToken,
  requireAdminOrTreinoOwner,
  upload.single("imagem"),
  updateTreino
);

// excluir
router.delete("/:id", authenticateToken, requireAdminOrTreinoOwner, deleteTreino);

export default router;