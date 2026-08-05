import { Router } from "express";
import {
  listarTurmas,
  criarTurma,
  substituirAlunosTurma,
  setProfessoresTurma,
  listarMinhasTurmas,
  getAlunosTurma,
  deleteTurma,
  listarTurmasComoProfessor,
  frequencia,
  updateTurma,
} from "../controllers/turmasController.js";

const router = Router();

router.get("/minhas", listarMinhasTurmas);
router.get("/como-professor", listarTurmasComoProfessor);
router.get("/:id/alunos", getAlunosTurma);
router.post("/:id/alunos", substituirAlunosTurma);
router.get("/:id/frequencia", frequencia);
router.put("/:id/atribuir-professores", setProfessoresTurma);
router.put("/:id/atribuir-professor", setProfessoresTurma);
router.put("/:id/vincular-professor", setProfessoresTurma);
router.delete("/:id", deleteTurma);
router.put("/:id", updateTurma);
router.get("/", listarTurmas);
router.post("/", criarTurma);

export default router;