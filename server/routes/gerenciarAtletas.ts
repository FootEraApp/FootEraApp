// server/routes/gerenciarAtletas
import { Router } from "express";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";

const router = Router();

router.get("/ranking", ctrl.ranking);
router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);
router.get("/treinosprogramados", ctrl.listTreinos);

router.get("/atletas/:usuarioId/detalhes", ctrl.detalhesAtleta);

router.get("/atletas/:usuarioId/submissoes", ctrl.submissoesAtleta);

// Designar/convocar treino programado para atletas vinculados
// POST /api/gerenciar/treinosprogramados/convocar
// body: { treinoProgramadoId: string, destinatarios: string[] (usuarioIds), objetivo?, prazo?, origem: "escolinha"|"clube" }
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);

export default router;
