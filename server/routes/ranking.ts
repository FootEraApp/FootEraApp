// server/routes/ranking
import { Router } from "express";
import { rankingController } from "../controllers/rankingController.js";
import { rankingSemanal } from "../controllers/rankingSemanalController.js";
import { rankingGlobal, rankingPosicao } from "../controllers/rankingGlobalController.js";

const router = Router();

router.get("/", rankingController.index);
router.get("/weekly", rankingSemanal);

router.get("/global", rankingGlobal);
router.get("/posicao", rankingPosicao);

export default router;