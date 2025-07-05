import { Router } from "express";
import { treinosLivresController } from "../controllers/treinosLivresController";

const router = Router();

router.get("/treinos-livres", treinosLivresController.index);
router.post("/treinos-livres", treinosLivresController.create);
router.get("/treinos-livres/:id", treinosLivresController.show);
router.delete("/treinos-livres/:id", treinosLivresController.delete);

export default router;
