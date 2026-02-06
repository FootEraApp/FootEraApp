// server/routes/upload
import { Router } from "express";
import { uploadMidia } from "../controllers/uploadController.js";

const router = Router();
router.post("/perfil", ...uploadMidia);

export default router;