// server/routes/logErro.routes.ts
import { Router } from "express";
import { getLogs, createLog } from "../controllers/logErroController";

const router = Router();

// GET /api/logs
router.get("/", getLogs);

// POST /api/logs
router.post("/", createLog);

export default router;
