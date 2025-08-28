// server/routes/upload

import { Router } from "express";
import { uploadFotoPerfil } from "../controllers/uploadController.js";

const router = Router();
router.post("/perfil", ...uploadFotoPerfil);

export default router;
