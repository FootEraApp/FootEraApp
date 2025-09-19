import { Router } from "express";
import { rankingController } from "../controllers/rankingController.js";
import { rankingSemanal } from "../controllers/rankingSemanalController.js";

const router = Router();

router.get("/", rankingController.index);
router.get("/weekly", rankingSemanal);

export default router;