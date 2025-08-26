import { Router } from "express";
import { rankingController } from "../controllers/rankingController.js";

const router = Router();

router.get("/", rankingController.index);

export default router;
