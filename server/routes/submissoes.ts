// server/routes/submissoes
import { Router } from "express";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth.js";
import {
  criarSubmissaoTreinoUpload,
  criarSubmissaoDesafioUpload,
  getUltimaSubmissaoTreino
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

router.post(
  "/treino",
  authenticateToken,
  upload.single("arquivo"),
  (req: AuthenticatedRequest, res) => criarSubmissaoTreinoUpload(req, res)
);

router.post(
  "/desafio",
  authenticateToken,
  upload.single("arquivo"),
  (req: AuthenticatedRequest, res) => criarSubmissaoDesafioUpload(req, res)
);

router.get(
  "/treino/ultima",
  authenticateToken,
  (req: AuthenticatedRequest, res) => getUltimaSubmissaoTreino(req, res)
);

export default router;