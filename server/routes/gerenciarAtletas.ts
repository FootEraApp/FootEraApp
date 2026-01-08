// server/routes/gerenciarAtletas
import { Router } from "express";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";

const router = Router();

router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);
router.get("/atletas/:usuarioId/detalhes", ctrl.detalhesAtleta);
router.get("/atletas/:usuarioId/submissoes", ctrl.submissoesAtleta);
router.get("/atletas/:atletaId/agendados", ctrl.agendadosAtleta);
router.get("/submissoes/treino/:submissaoTreinoId/avaliacao", ctrl.getAvaliacaoSubmissaoTreino);
router.put("/submissoes/treino/:submissaoTreinoId/avaliacao", ctrl.upsertAvaliacaoSubmissaoTreino);
router.post("/submissoes/treino/:submissaoTreinoId/comentarios", ctrl.addComentarioAvaliacaoSubmissaoTreino);
router.put("/submissoes/treino/:submissaoTreinoId/comentarios/:comentarioId", ctrl.updateComentarioAvaliacaoSubmissaoTreino);
router.delete("/submissoes/treino/:submissaoTreinoId/comentarios/:comentarioId", ctrl.deleteComentarioAvaliacaoSubmissaoTreino);
router.get("/atletas", ctrl.list);
router.get("/professores", ctrl.listProfessores);
router.get("/treinosprogramados", ctrl.listTreinos);
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);
router.get("/ranking", ctrl.ranking);
router.get("/treinosprogramados/visiveis", ctrl.listTreinosVisiveis);

export default router;