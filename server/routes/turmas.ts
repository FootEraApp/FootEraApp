import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listTurmas, createTurma, updateTurma, setProfessorTurma, deleteTurma, professoresDisponiveis
} from "../controllers/turmasController.js";

const router = Router();

router.get("/professores-disponiveis", authenticateToken, professoresDisponiveis);
router.get("/", authenticateToken, listTurmas);
router.post("/", authenticateToken, createTurma);
router.put("/:id/atribuir-professor", authenticateToken, setProfessorTurma);
router.put("/:id", authenticateToken, updateTurma);
router.delete("/:id", authenticateToken, deleteTurma);

export default router;