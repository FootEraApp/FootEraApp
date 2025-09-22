import { Router } from "express";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth.js";
import {
  criarSubmissaoTreinoUpload,
  criarSubmissaoDesafioUpload,
} from "../controllers/submissoesController.js";

const router = Router();

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});
const upload = multer({ storage });

// === Treino ===
router.post(
  "/treino",
  authenticateToken,
  upload.single("arquivo"),
  (req: AuthenticatedRequest, res) => criarSubmissaoTreinoUpload(req, res)
);

// === Desafio (agora igual ao desafiosController: aprovado=true + recompute) ===
router.post(
  "/desafio",
  authenticateToken,
  upload.single("arquivo"),
  (req: AuthenticatedRequest, res) => criarSubmissaoDesafioUpload(req, res)
);

export default router;
