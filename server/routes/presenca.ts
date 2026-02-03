import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getPresenca, pingPresenca } from "../controllers/presencaController.js";

const router = Router();

router.get("/:id", authenticateToken, getPresenca);
router.post("/ping", authenticateToken, pingPresenca);

export default router;