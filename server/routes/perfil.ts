// Server/routes/perfil

import { Router } from "express";
import {
  getPontuacaoDetalhada, getPerfilUsuario, getAtividadesRecentes, getBadges,
  getTreinosResumo, getProgressoTreinos, getPontuacaoPerfil,
  getPerfilUsuarioMe, getPontuacaoMe, getAtividadesRecentesMe, getBadgesMe, atualizarPerfil, getPosicaoAtualAtleta,
  getPerfilProfessor, getPerfilClube, getPerfilEscola,
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

// ROTAS ESPECÍFICAS POR TIPO (adicione ANTES do genérico "/:id")
router.get("/professor/me", authenticateToken, (req, res) => {
  (req as any).params = { id: req.userId };
  getPerfilProfessor(req as any, res);
});
router.get("/professor/:id", authenticateToken, getPerfilProfessor);

router.get("/clube/me", authenticateToken, (req, res) => {
  (req as any).params = { id: req.userId };
  getPerfilClube(req as any, res);
});
router.get("/clube/:id", authenticateToken, getPerfilClube);

router.get("/escola/me", authenticateToken, (req, res) => {
  (req as any).params = { id: req.userId };
  getPerfilEscola(req as any, res);
});
router.get("/escola/:id", authenticateToken, getPerfilEscola);

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

router.get("/me/posicao-atual", authenticateToken, (req, res) => {
  getPosicaoAtualAtleta(req, res);
});
router.get("/:id/posicao-atual", authenticateToken, (req, res) => {
  getPosicaoAtualAtleta(req, res);
});

export default router;