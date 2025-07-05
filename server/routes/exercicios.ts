// routes/exercicios.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  getExercicios,
  getExercicioById,
  createExercicio,
  updateExercicio,
  deleteExercicio
} from "../controllers/exerciciosController";

const router = Router();

// configuração do multer
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "public/uploads/videos"),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get("/", getExercicios);
router.get("/:id", getExercicioById);
router.post("/", upload.single("video"), createExercicio);
router.put("/:id", upload.single("video"), updateExercicio);
router.delete("/:id", deleteExercicio);

export default router;
