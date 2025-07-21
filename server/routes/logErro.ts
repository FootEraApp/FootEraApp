import { Router } from "express";
import { getLogs, createLog } from "../controllers/logErroController";

const router = Router();

router.get("/", getLogs);
router.post("/", createLog);

export default router;
