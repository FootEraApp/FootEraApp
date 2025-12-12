import { Router } from "express";
import multer from "multer";
import { treinosLivresController } from "../controllers/treinosLivresController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();

const upload = multer({
  dest: "public/uploads/treinos-livres",
});

router.use(authenticateToken);

router.get("/treinos-livres", treinosLivresController.index);
router.post(
  "/treinos-livres",
  upload.single("midia"),          
  treinosLivresController.create
);
router.get("/treinos-livres/:id", treinosLivresController.show);
router.delete("/treinos-livres/:id", treinosLivresController.delete);

export default router;