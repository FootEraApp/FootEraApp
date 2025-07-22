import express from "express";
import multer from "multer"
import { criarProfessor, editarProfessor, excluirProfessor, listarProfessores, buscarProfessorPorId } from "../controllers/professoresController";

const router = express.Router();
const upload = multer({ dest: "upload/" });

router.get("/", listarProfessores);
router.get("/:id", buscarProfessorPorId);
router.post("/", upload.single("foto"), criarProfessor);
router.put("/:id", editarProfessor);
router.delete("/:id", excluirProfessor);

export default router;
