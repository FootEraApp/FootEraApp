import { Router } from "express";
import { adminDashboard, loginAdmin } from "../controllers/adminController.js";

const router = Router();

router.get("/", adminDashboard);
router.post("/login", loginAdmin);

export default router;
