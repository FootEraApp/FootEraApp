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
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/como-professor", authenticateToken, listarTurmasComoProfessor);
router.get("/:id/alunos", authenticateToken, getAlunosTurma);
router.get("/minhas", authenticateToken, listarMinhasTurmas);
router.post("/:id/alunos", authenticateToken, substituirAlunosTurma);
router.get("/:id/frequencia", authenticateToken, frequencia);
router.put("/:id/atribuir-professores", authenticateToken, setProfessoresTurma);
router.put("/:id/atribuir-professor", authenticateToken, setProfessoresTurma);
router.put("/:id/vincular-professor", authenticateToken, setProfessoresTurma);
router.delete("/:id", authenticateToken, deleteTurma);
router.put("/:id", authenticateToken, updateTurma);
router.get("/", authenticateToken, listarTurmas);
router.post("/", authenticateToken, criarTurma);

export default router;