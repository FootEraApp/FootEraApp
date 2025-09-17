import { Router } from "express";
import {
  createTreinoProgramado,
  getTreinoById,
  updateTreino,
  deleteTreino,
  getAllTreinos,
} from "../controllers/treinosProgramadosController.js";

const router = Router();

router.post("/", createTreinoProgramado);
router.get("/", getAllTreinos);
router.get("/:id", getTreinoById);
router.put("/:id", updateTreino);
router.delete("/:id", deleteTreino);

export default router;
