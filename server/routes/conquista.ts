import { Router } from "express";
import { compartilharConquista } from "../controllers/conquistaController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();
router.post("/compartilhar", authenticateToken, compartilharConquista);
export default router;