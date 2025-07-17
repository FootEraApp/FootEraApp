import { Router } from "express";
import { adminDashboard } from "../controllers/adminController";

const router = Router();

router.get("/", adminDashboard);

export default router;
