import { Router } from "express";
import { getPerfilUsuario, getTreinosResumo, getProgressoTreinos, getPontuacaoDetalhada, atualizarPerfil, getAtividadesRecentes, getBadges, getPontuacao  } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/me", authenticateToken, (req, res) => {
  getPerfilUsuario(req, res);
});

router.get("/:id", authenticateToken, getPerfilUsuario);
router.put("/:id", authenticateToken, atualizarPerfil);
router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/pontuacao", authenticateToken, getPontuacao);
router.get("/:id/pontuacao/detalhada", authenticateToken, getPontuacaoDetalhada);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);

export default router;