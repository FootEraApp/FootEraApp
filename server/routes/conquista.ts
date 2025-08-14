import { Router } from "express";
import { compartilharConquista } from "../controllers/conquistaController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();
router.post("/compartilhar", authenticateToken, compartilharConquista);
export default router;