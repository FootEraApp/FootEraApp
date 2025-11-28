import { Router } from "express";
import * as ctrl from "../controllers/eventosController.js";

const router = Router();

router.get("/minha-agenda", ctrl.auth, ctrl.minhaAgenda);
router.get("/atleta/:usuarioId", ctrl.auth, ctrl.eventosDoAtleta);
router.get("/clubes/:clubeId", ctrl.listarDoClube);
router.post(
  "/clubes/:clubeId",
  ctrl.auth,
  ctrl.ehDonoDoClubeOuAdmin,
  ctrl.criar
);

router.get("/:id", ctrl.obter);

export default router;