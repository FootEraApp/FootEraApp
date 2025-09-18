// server/routes/treinos.ts
import { Router } from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import {
  // Treinos
  treinosDisponiveis,
  listarTodosTreinosProgramados,
  obterTreinoProgramadoPorId,
  agendarTreino,
  excluirTreinoAgendado,
  getTreinosAgendados,
  concluirTreino,
  criarTreinoProgramado,
  restaurarTreinos,

  // Exercícios / Métricas
  getExercicios,
  getPontuacoes,

  // Elencos
  getEscalaPorElencoId,
  getEscalaPorDono,
  listarElencos,
  criarElenco,
  atualizarElenco,

  // Perfil (atletas vinculados)
  atletasVinculados,
} from "server/controllers/treinosController.js";

const router = Router();

/* ---- PERFIL / ATLETAS VINCULADOS ---- */
router.get("/atletas-vinculados", atletasVinculados);

/* ---- TREINOS ---- */
router.get("/disponiveis", treinosDisponiveis);
router.get("/programados", listarTodosTreinosProgramados);
router.get("/:id", authenticateToken, obterTreinoProgramadoPorId);

router.post("/agendados", authenticateToken, agendarTreino);
router.delete("/agendados/:id", authenticateToken, excluirTreinoAgendado);
router.get("/agendados", authenticateToken, getTreinosAgendados);
router.post("/concluir", authenticateToken, concluirTreino);
router.post("/restaurar", authenticateToken, restaurarTreinos);
router.post("/", criarTreinoProgramado);

/* ---- EXERCÍCIOS / PONTUAÇÕES ---- */
router.get("/exercicios", getExercicios);
router.get("/pontuacoes", authenticateToken, getPontuacoes);

/* ---- ELENCOS ---- */
router.get("/elencos/:id/escala", authenticateToken, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", authenticateToken, getEscalaPorDono);
router.get("/elencos", authenticateToken, listarElencos);
router.post("/elencos", authenticateToken, criarElenco);
router.put("/elencos/:id", authenticateToken, atualizarElenco);

export default router;
