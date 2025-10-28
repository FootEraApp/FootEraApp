// routes/gerenciarAtletasRoutes.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";

const router = Router();

// Protege tudo
router.use(authenticateToken);

// Atletas
router.get("/atletas", ctrl.list);
router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);
router.get("/atletas/:usuarioId/detalhes", ctrl.detalhesAtleta);
router.get("/atletas/:usuarioId/submissoes", ctrl.submissoesAtleta);

// Professores (necessária para a aba Professores)
router.get("/professores", ctrl.listProfessores);

// Treinos Programados
router.get("/treinosprogramados", ctrl.listTreinos);
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);

// Ranking (se usado em outra tela)
router.get("/ranking", ctrl.ranking);

export default router;