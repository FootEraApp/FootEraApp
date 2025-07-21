import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createExercicio, getAllExercicios, updateExercicio, deleteExercicio, getExercicioById } from "../controllers/exerciciosController";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads", "videos"),
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    cb(null, filename);
  },
});
const upload = multer({ storage });

router.post("/create", upload.single("video"), createExercicio);
router.put("/:id", upload.single("video"), updateExercicio);
router.delete("/:id", deleteExercicio);
router.get("/:id", getExercicioById);
router.get("/", getAllExercicios);

export default router;
