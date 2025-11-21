import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { registrarImpressaoAd } from "server/controllers/adsController.js";

const router = Router();

router.post("/impression", authenticateToken, registrarImpressaoAd);

export default router;