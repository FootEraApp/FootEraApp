import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getBadge } from "../controllers/notificacoesController.js";

const r = Router();

r.get("/badge", authenticateToken, getBadge);

export default r;
