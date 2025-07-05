// server/routes/searchRoutes.ts
import { Router } from "express";
import { buscar, explorar } from "../controllers/searchController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/buscar", authenticateToken, buscar);
router.get("/explorar", authenticateToken, explorar);

export default router;
