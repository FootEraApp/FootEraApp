import { Router } from "express";
import { uploadFotoPerfil } from "../controllers/uploadController";

const router = Router();
router.post("/perfil", ...uploadFotoPerfil);

export default router;
