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
  listarSubmissoesParaValidacao,
  validarSubmissaoTreino,
  listarMinhasSubmissoesTreino,
  iniciarTreino,
  statusDesafiosSemanais,
  getTreinoStatus,
  agendarRotinaMensal,
  expirarTreinosVencidos,
  iniciarTreinoAgendado,
  finalizarTreinoAgendado,
  atualizarAgendamento,
  agendarTreinoLote,
  agendarTreinoPessoal,
  salvarTreinoNaBiblioteca,
  getCalendarioTreinos,
  relacaoStatus,
  getTreinosProgramadosStats,
  realizadosCount
} from "server/controllers/treinosController.js";
import { criarAvaliacaoTreino } from "../controllers/avaliacoesTreinoController.js";
import { requireElencoOwner } from "server/middlewares/membership.js";
import { requireCapability, requireOrgSeat } from "server/middlewares/guards.js";

const router = Router();
router.use(authenticateToken);

router.get("/relacao-treino/status", relacaoStatus);
router.get("/elencos/:id/escala", requireElencoOwner, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", getEscalaPorDono);
router.get("/elencos", listarElencos);
router.get("/realizados-count", realizadosCount);

router.post(
  "/elencos",
  requireOrgSeat(req => (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  criarElenco
);

router.put("/elencos/:id", requireElencoOwner, atualizarElenco);

router.post("/agendados/:id/iniciar", iniciarTreino);
router.delete("/agendados/:id", excluirTreinoAgendado);
router.post("/agendados/:id/complete", concluirTreino);
router.get("/agendados", getTreinosAgendados);
router.put("/agendados/:id", atualizarAgendamento);
router.post("/agendados",
  requireCapability("agendamento:pessoal"),
  agendarTreino
);

router.get(
  "/programados/stats",
  authenticateToken,
  getTreinosProgramadosStats
);
router.get("/programados/:id", obterTreinoProgramadoPorId);
router.put(
  "/programados/:id",
  requireOrgSeat(req => (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  atualizarTreinoProgramado
);
router.delete("/programados/:id", deletarTreinoProgramado);
router.get("/programados", listarTodosTreinosProgramados);

router.post(
  "/agendar-lote",
  requireCapability("agendamento:lote"),
  agendarTreinoLote
);

router.get("/calendario", getCalendarioTreinos);
router.post("/expirar-vencidos", expirarTreinosVencidos);

router.get("/minhas-submissoes", listarMinhasSubmissoesTreino);
router.post("/submissoes/:id/validar", validarSubmissaoTreino);
router.get("/submissoes", listarSubmissoesParaValidacao);

router.post("/:id/start", iniciarTreinoAgendado);
router.post("/:id/finish", finalizarTreinoAgendado);

router.get("/:treinoId/status", getTreinoStatus);
router.get("/disponiveis", treinosDisponiveis);

router.get("/atletas-vinculados", atletasVinculados);
router.post("/restaurar", restaurarTreinos);
router.get("/exercicios", getExercicios);
router.get("/pontuacoes", getPontuacoes);
router.get("/desafios-semanais", statusDesafiosSemanais);

router.post(
  "/rotina/agendar",
  agendarRotinaMensal
);

router.post("/avaliacoes", authenticateToken, criarAvaliacaoTreino);
router.post(
  "/org/:orgId/rotina/agendar",
  requireOrgSeat(req => (req.params?.orgId as string) || (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  requireCapability("agendamento:lote"),
  agendarRotinaMensal
);

router.post(
  "/agendar-pessoal",
  requireCapability("agendamento:pessoal"),
  agendarTreinoPessoal
);

router.post(
  "/biblioteca",
  salvarTreinoNaBiblioteca
);

router.post("/", criarTreinoProgramado);
router.get("/", listarTodosTreinosProgramados);

export default router;