// server/routes/midia.routes.ts
import { Router } from "express";
import { getMidias, uploadMidia, deleteMidia } from "../controllers/midiaController";
import { upload } from "../middlewares/upload"; // middleware do multer

const router = Router();

// Buscar mídias por atleta
router.get("/:atletaId", getMidias);

// Enviar nova mídia
router.post("/:atletaId", upload.single("arquivo"), uploadMidia);

// Deletar mídia
router.delete("/:id", deleteMidia);

export default router;
