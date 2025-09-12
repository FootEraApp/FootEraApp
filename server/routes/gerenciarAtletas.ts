import { Router } from "express";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";

const router = Router();

router.get("/ranking", ctrl.ranking);
router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);
router.get("/treinosprogramados", ctrl.listTreinos);
router.get("/atletas", ctrl.list);
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);

export default router;
