// server/routes/professorRoutes.ts
import { Router } from "express";
import multer from "multer";
import {
  getProfessores,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  getProfessorById
} from "../controllers/professoresController";

const router = Router();
const upload = multer(); // armazena em memória, pode ser customizado com diskStorage

router.get("/", getProfessores);
router.get("/:id", getProfessorById);
router.post("/", upload.single("foto"), createProfessor);
router.put("/:id", upload.single("foto"), updateProfessor);
router.delete("/:id", deleteProfessor);

export default router;
