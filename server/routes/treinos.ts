import { Router } from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import {
  treinosDisponiveis,
  listarTodosTreinosProgramados,
  obterTreinoProgramadoPorId,
  agendarTreino,
  excluirTreinoAgendado,
  getTreinosAgendados,
  concluirTreino,
  criarTreinoProgramado,
  restaurarTreinos,
  atualizarTreinoProgramado,
  deletarTreinoProgramado,
  getExercicios,
  getPontuacoes,
  getEscalaPorElencoId,
  getEscalaPorDono,
  listarElencos,
  criarElenco,
  atualizarElenco,
  atletasVinculados,
} from "server/controllers/treinosController.js";

const router = Router();

router.get("/disponiveis", treinosDisponiveis);

router.get("/atletas-vinculados", atletasVinculados);

router.get("/agendados", authenticateToken, getTreinosAgendados);
router.post("/agendados", authenticateToken, agendarTreino);
router.delete("/agendados/:id", authenticateToken, excluirTreinoAgendado);
router.post("/concluir", authenticateToken, concluirTreino);

router.get("/programados", listarTodosTreinosProgramados);
router.get("/programados/:id", authenticateToken, obterTreinoProgramadoPorId);
router.put("/programados/:id", authenticateToken, atualizarTreinoProgramado);
router.delete("/programados/:id", authenticateToken, deletarTreinoProgramado);
router.post("/restaurar", authenticateToken, restaurarTreinos);
router.post("/", criarTreinoProgramado);

router.get("/exercicios", getExercicios);
router.get("/pontuacoes", authenticateToken, getPontuacoes);

router.get("/elencos/:id/escala", authenticateToken, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", authenticateToken, getEscalaPorDono);
router.get("/elencos", authenticateToken, listarElencos);
router.post("/elencos", authenticateToken, criarElenco);
router.put("/elencos/:id", authenticateToken, atualizarElenco);

export default router;