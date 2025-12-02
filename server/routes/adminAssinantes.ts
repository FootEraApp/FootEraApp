import { Router } from "express";
import { adminAuth } from "../middlewares/admin-auth.js";
import { listar, overview } from "../controllers/assinaturasAdminController.js";

const router = Router();

router.get("/overview", adminAuth, overview);
router.get("/", adminAuth, listar);

export default router;