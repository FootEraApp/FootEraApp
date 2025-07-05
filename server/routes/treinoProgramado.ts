import { Router } from "express";
import { treinosProgramadosController } from "../controllers/treinosProgramadosController";

const router = Router();

router.get("/", treinosProgramadosController.index);
router.post("/", treinosProgramadosController.create);
router.get("/:id", treinosProgramadosController.show);
router.put("/:id", treinosProgramadosController.update);
router.delete("/:id", treinosProgramadosController.delete);

router.post("/agendar", treinosProgramadosController.agendarTreino);
router.delete("/agendado/:id", treinosProgramadosController.excluirAgendamento);

router.get("/dashboard/lista", treinosProgramadosController.dashboard);

export default router;
