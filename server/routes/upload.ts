import { Router } from "express";
import multer from "multer";
import { uploadController } from "../controllers/uploadController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Armazena em memória para envio direto ao S3

router.post("/upload/file", upload.single("file"), uploadController.uploadFile);

export default router;
