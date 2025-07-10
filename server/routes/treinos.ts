import { Router } from "express";
import { treinosController } from "../controllers/treinosController";

const router = Router();

router.get("/treinos/dashboard", treinosController.dashboard);

export default router;
