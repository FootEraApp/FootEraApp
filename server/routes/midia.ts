import { Router } from "express";
import { getMidias, uploadMidia, deleteMidia } from "../controllers/midiaController.js";
import { upload } from "../middlewares/upload.js"; 

const router = Router();

router.get("/:atletaId", getMidias);
router.post("/:atletaId", upload.single("arquivo"), uploadMidia);
router.delete("/:id", deleteMidia);

export default router;
