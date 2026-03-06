// server/routes/gerenciarAtletas
import { Router } from "express";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);
router.get("/atletas/:usuarioId/detalhes", ctrl.detalhesAtleta);
router.get("/atletas/:usuarioId/submissoes", ctrl.submissoesAtleta);
router.get("/atletas/:atletaId/agendados", ctrl.agendadosAtleta);
router.get("/atletas", ctrl.list);
router.get("/submissoes/treino/:submissaoTreinoId/avaliacao", ctrl.getAvaliacaoSubmissaoTreino);
router.put("/submissoes/treino/:submissaoTreinoId/avaliacao", ctrl.upsertAvaliacaoSubmissaoTreino);
router.post("/submissoes/treino/:submissaoTreinoId/comentarios", ctrl.addComentarioAvaliacaoSubmissaoTreino);
router.put("/submissoes/treino/:submissaoTreinoId/comentarios/:comentarioId", ctrl.updateComentarioAvaliacaoSubmissaoTreino);
router.delete("/submissoes/treino/:submissaoTreinoId/comentarios/:comentarioId", ctrl.deleteComentarioAvaliacaoSubmissaoTreino);
router.get("/treinosprogramados/visiveis", ctrl.listTreinosVisiveis);
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);
router.get("/treinosprogramados", ctrl.listTreinos);
router.get("/ranking", ctrl.ranking);
router.get("/professores", ctrl.listProfessores);

export default router;