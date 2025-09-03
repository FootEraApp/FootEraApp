import { Router } from "express";
import {
  getPontuacaoDetalhada, getPerfilUsuario, getAtividadesRecentes, getBadges,
  getTreinosResumo, getProgressoTreinos, getPontuacaoPerfil,
  getPerfilUsuarioMe, getPontuacaoMe, getAtividadesRecentesMe, getBadgesMe, atualizarPerfil, getPosicaoAtualAtleta
} from "../controllers/perfilController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import { pontuacaoDoPerfil } from "server/controllers/pontuacoesController.js";
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

// mantenha os /me primeiro
router.get("/me", authenticateToken, getPerfilUsuarioMe);
router.get("/me/pontuacao", authenticateToken, getPontuacaoMe);
router.get("/me/atividades", authenticateToken, getAtividadesRecentesMe);
router.get("/me/badges", authenticateToken, getBadgesMe);
router.get("/me/posicao-atual", authenticateToken, getPosicaoAtualAtleta);
// antes das rotas dinâmicas (coloque após os /me)
router.get("/pontuacao", authenticateToken, getPontuacaoMe);

// ✅ use só ESSA forma no back e no front:
router.get("/:usuarioId/pontuacao", authenticateToken, pontuacaoDoPerfil);

// outros recursos específicos por id
router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);
router.get("/:id/posicao-atual", authenticateToken, getPosicaoAtualAtleta);

// por último o GET genérico e o PUT
router.get("/:id", authenticateToken, getPerfilUsuario);
router.put("/:id", authenticateToken, upload.single("foto"), atualizarPerfil);

export default router;