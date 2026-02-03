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

router.get("/:id", authenticateToken, getTreinoById);
router.get("/", authenticateToken, getAllTreinos);
router.post(
  "/",
  authenticateToken,
  requireAdminOrTreinoOwner,
  upload.single("imagem"), 
  createTreinoProgramado
);
router.put(
  "/:id",
  authenticateToken,
  requireAdminOrTreinoOwner,
  upload.single("imagem"),
  updateTreino
);
router.delete("/:id", authenticateToken, requireAdminOrTreinoOwner, deleteTreino);

export default router;