// server/routes/perfil

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

router.get("/me", authenticateToken, getPerfilUsuarioMe);
router.get("/me/pontuacao", authenticateToken, getPontuacaoMe);
router.get("/me/atividades", authenticateToken, getAtividadesRecentesMe);
router.get("/me/badges", authenticateToken, getBadgesMe);

router.get("/:usuarioId/pontuacao", authenticateToken, pontuacaoDoPerfil);
router.get("/pontuacao/:usuarioId", authenticateToken, getPontuacaoPerfil);
router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/pontuacao", authenticateToken, getPontuacaoDetalhada);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);
router.get("/:id", authenticateToken, getPerfilUsuario);
router.put("/:id", authenticateToken, upload.single("foto"), atualizarPerfil);

// 🔽 NOVAS ROTAS PARA POSIÇÃO
// usa id do token
router.get("/me/posicao-atual", authenticateToken, (req, res) => {
  getPosicaoAtualAtleta(req, res);
});
// usa id do path (perfil de outro usuário)
router.get("/:id/posicao-atual", authenticateToken, (req, res) => {
  getPosicaoAtualAtleta(req, res);
});

export default router;