import { Router } from "express";
import { gerenciarAtletasController as ctrl } from "../controllers/gerenciarAtletasController.js";

const router = Router();

// Lista atletas vinculados à entidade (escolinha/clube) com filtros/ordenação
// GET /api/gerenciar/atletas?vinculo=escolinha|clube&id=<usuarioId>&search=&categoria=&posicao=&status=&order=
router.get("/atletas", ctrl.list);

// Ranking interno por pontuação
// GET /api/gerenciar/ranking?vinculo=escolinha|clube&id=<usuarioId>
router.get("/ranking", ctrl.ranking);

// Estatísticas rápidas do atleta para painel lateral
// GET /api/gerenciar/atletas/:usuarioId/pontuacao
router.get("/atletas/:usuarioId/pontuacao", ctrl.statsAtleta);

// Lista de treinos programados criados pela entidade
// GET /api/gerenciar/treinosprogramados?criador=escolinha|clube&id=<usuarioId>
router.get("/treinosprogramados", ctrl.listTreinos);

// Designar/convocar treino programado para atletas vinculados
// POST /api/gerenciar/treinosprogramados/convocar
// body: { treinoProgramadoId: string, destinatarios: string[] (usuarioIds), objetivo?, prazo?, origem: "escolinha"|"clube" }
router.post("/treinosprogramados/convocar", ctrl.convocarTreino);

export default router;
