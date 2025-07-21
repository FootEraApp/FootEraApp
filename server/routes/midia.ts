import { Router } from "express";
import { getMidias, uploadMidia, deleteMidia } from "../controllers/midiaController";
import { upload } from "../middlewares/upload"; // middleware do multer

const router = Router();

router.get("/:atletaId", getMidias);
router.post("/:atletaId", upload.single("arquivo"), uploadMidia);
router.delete("/:id", deleteMidia);

export default router;
