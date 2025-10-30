import { Router } from "express";
import {
  listarTurmas,
  criarTurma,
  obterAlunosTurma,
  substituirAlunosTurma,
  vincularProfessor,
} from "../controllers/turmasController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateToken, listarTurmas);
router.post("/", authenticateToken, criarTurma);

router.get("/:id/alunos", authenticateToken, obterAlunosTurma);
router.post("/:id/alunos", authenticateToken, substituirAlunosTurma);

router.put("/:id/vincular-professor", authenticateToken, vincularProfessor);

export default router;