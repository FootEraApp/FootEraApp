import { Router } from "express";
import {
  createTreinoProgramado,
  getTreinoById,
  updateTreino,
  deleteTreino,
  getAllTreinos,
} from "../controllers/treinosProgramadosController.js";

const router = Router();

// CRUD — sem lógica aqui, tudo no controller
router.post("/", createTreinoProgramado);
router.get("/", getAllTreinos);
router.get("/:id", getTreinoById);
router.put("/:id", updateTreino);
router.delete("/:id", deleteTreino);

export default router;
