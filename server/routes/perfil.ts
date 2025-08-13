import { Router } from "express";
import {
  getPerfilUsuario, getPontuacao, getAtividadesRecentes, getBadges,
  getTreinosResumo, getProgressoTreinos, getPontuacaoPerfil,
  getPerfilUsuarioMe, getPontuacaoMe, getAtividadesRecentesMe, getBadgesMe, atualizarPerfil
} from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import multer from "multer";

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });
const router = Router();

router.get("/me", authenticateToken, getPerfilUsuarioMe);
router.get("/me/pontuacao", authenticateToken, getPontuacaoMe);
router.get("/me/atividades", authenticateToken, getAtividadesRecentesMe);
router.get("/me/badges", authenticateToken, getBadgesMe);

router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/pontuacao", authenticateToken, getPontuacao);
router.get("/pontuacao/:usuarioId", authenticateToken, getPontuacaoPerfil);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);
router.get("/:id", authenticateToken, getPerfilUsuario);
router.put("/:id", authenticateToken, upload.single("foto"), atualizarPerfil);

export default router;