import express from "express";
import multer from "multer";
import path from "path";
import { createProfessor, updateProfessor, deleteProfessor, getProfessores } from "../controllers/professoresController";

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
