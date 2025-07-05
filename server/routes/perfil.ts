// src/routes/perfilRoutes.ts
import { Router } from "express";
import { getPerfil } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/:id", authenticateToken, getPerfil);

export default router;
