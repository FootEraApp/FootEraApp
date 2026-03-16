// server/routes/perfil
import { Router } from "express";
import {
  getPerfilUsuario, getAtividadesRecentes, getBadges,
  getTreinosResumo, getProgressoTreinos, getPerfilUsuarioMe, getPontuacaoMe,
  getAtividadesRecentesMe, getBadgesMe, atualizarPerfil, getPosicaoAtualAtleta,
  getPerfilProfessor, getPerfilClube, getPerfilEscola, getPerfilOlheiro, 
  getUltimasSubmissoesDesafioVideosMe, getUltimasSubmissoesDesafioVideos,
  getPontuacaoPerfil
} from "../controllers/perfilController.js";
import { authenticateToken } from "../middlewares/auth.js";
import multer from "multer";
import { uploadToS3 } from "../middlewares/s3Upload.js";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, "uploads/");
  },
  filename: function (_req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });
const router = Router();

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
router.get("/olheiro/me", authenticateToken, (req, res) => {
  (req as any).params = { id: req.userId };
  getPerfilOlheiro(req as any, res);
});
router.get("/olheiro/:id", authenticateToken, getPerfilOlheiro);
router.get("/me/pontuacao", authenticateToken, getPontuacaoMe);
router.get("/me/atividades", authenticateToken, getAtividadesRecentesMe);
router.get("/me/badges", authenticateToken, getBadgesMe);
router.get("/me/posicao-atual", authenticateToken, getPosicaoAtualAtleta);
router.get("/me/desafios-videos", authenticateToken, getUltimasSubmissoesDesafioVideosMe);
router.get("/me", authenticateToken, getPerfilUsuarioMe);
router.get("/:usuarioId/pontuacao", authenticateToken, getPontuacaoPerfil);
router.get("/:id/desafios-videos", authenticateToken, getUltimasSubmissoesDesafioVideos);
router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);
router.get("/:id/posicao-atual", authenticateToken, getPosicaoAtualAtleta);
router.get("/:id", authenticateToken, getPerfilUsuario);

router.put("/:id", authenticateToken, uploadToS3.single("foto"), atualizarPerfil);

export default router;