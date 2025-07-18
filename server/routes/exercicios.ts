import express from "express";
import multer from "multer";
import path from "path";
import { createExercicio, updateExercicio, deleteExercicio, getExercicioById } from "../controllers/exerciciosController";

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads", "videos"),
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    cb(null, filename);
  },
});
const upload = multer({ storage });

router.post("/", upload.single("video"), createExercicio);
router.put("/:id", upload.single("video"), updateExercicio);
router.delete("/:id", deleteExercicio);
router.get("/:id", getExercicioById);

export default router;
