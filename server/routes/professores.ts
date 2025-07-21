import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createProfessor, updateProfessor, deleteProfessor, getProfessores } from "../controllers/professoresController";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads", "fotos"),
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    cb(null, filename);
  },
});
const upload = multer({ storage });

router.post("/", upload.single("foto"), createProfessor);
router.put("/:id", upload.single("foto"), updateProfessor);
router.delete("/:id", deleteProfessor);
router.get("/", getProfessores);

export default router;
