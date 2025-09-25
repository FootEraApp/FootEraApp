import { Router } from "express";
import { formadoresController as C } from "../controllers/formadoresController.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { FORMADORES_DIR, ensureUploadDirs } from "../utils/uploads.js";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "formadores");
fs.mkdirSync(uploadDir, { recursive: true });

ensureUploadDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FORMADORES_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ok =
    /image\/(png|jpe?g|gif|webp)/.test(file.mimetype) ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype === "application/vnd.ms-powerpoint" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  cb(null, ok);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

router.get("/dashboard", C.dashboard);
router.get("/atletas", C.listarAtletas);
router.post("/atletas", C.criarVinculo);
router.get("/transferencias", C.listarTransferencias);
router.post("/transferencias", C.criarTransferencia);
router.get("/badges", C.listarBadges);
router.post("/calcular-solidariedade", C.calcularSolidariedade);
router.get("/documentos", C.listarDocumentos);
router.post("/upload", upload.array("files", 10), C.uploadDocumentos);

export default router;