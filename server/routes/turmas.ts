// server/routes/turmas
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
  
} from "../controllers/turmasController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/como-professor", authenticateToken, listarTurmasComoProfessor);
router.get("/:id/alunos", authenticateToken, getAlunosTurma);
router.get("/minhas", authenticateToken, listarMinhasTurmas);
router.post("/:id/alunos", authenticateToken, substituirAlunosTurma);
router.put("/:id/atribuir-professores", authenticateToken, setProfessoresTurma);
router.put("/:id/atribuir-professor", authenticateToken, setProfessoresTurma);
router.put("/:id/vincular-professor", authenticateToken, setProfessoresTurma);
router.delete("/:id", authenticateToken, deleteTurma);
router.get("/", authenticateToken, listarTurmas);
router.post("/", authenticateToken, criarTurma);

export default router;