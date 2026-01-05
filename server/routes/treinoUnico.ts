import { Router } from "express";
import { getTreinoUnico } from "server/controllers/TreinoUnicoController.js";

const router = Router();

router.get("/", getTreinoUnico);

export default router;