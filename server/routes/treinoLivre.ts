import { Router } from "express";
import { treinosLivresController } from "../controllers/treinosLivresController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/treinos-livres", treinosLivresController.index);
router.post("/treinos-livres", treinosLivresController.create);
router.get("/treinos-livres/:id", treinosLivresController.show);
router.delete("/treinos-livres/:id", treinosLivresController.delete);

export default router;