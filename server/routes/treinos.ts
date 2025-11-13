// server/routes/treinos.ts
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
} from "server/controllers/treinosController.js";
import { requireElencoOwner } from "server/middlewares/membership.js";
import { requireCapability, requireOrgSeat } from "server/middlewares/guards.js";

const router = Router();
router.use(authenticateToken);

/* ===== ELENCOS ===== */
router.get("/elencos/:id/escala", requireElencoOwner, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", getEscalaPorDono);
router.get("/elencos", listarElencos);

router.post(
  "/elencos",
  requireCapability("agendamento:lote"),
  // valida assento na org quando vier escolinhaId/clubeId no body
  requireOrgSeat(req => (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  criarElenco
);

router.put("/elencos/:id", requireElencoOwner, atualizarElenco);

/* ===== AGENDADOS (treinos do atleta) ===== */
router.post("/agendados/:id/iniciar", iniciarTreino);
router.delete("/agendados/:id", excluirTreinoAgendado);
router.post("/agendados/:id/complete", concluirTreino);
router.get("/agendados", getTreinosAgendados);

router.post(
  "/agendados",
  requireCapability("agendamento:pessoal"),
  agendarTreino
);

/* ===== PROGRAMADOS ===== */
router.get("/programados/:id", obterTreinoProgramadoPorId);
router.put(
  "/programados/:id",
  // se atualizar dentro do contexto de org, exige seat
  requireOrgSeat(req => (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  atualizarTreinoProgramado
);
router.delete("/programados/:id", deletarTreinoProgramado);
router.get("/programados", listarTodosTreinosProgramados);

/* ===== SUBMISSÕES / STATUS ===== */
router.get("/minhas-submissoes", listarMinhasSubmissoesTreino);
router.post("/submissoes/:id/validar", validarSubmissaoTreino);
router.get("/submissoes", listarSubmissoesParaValidacao);

router.post("/:id/start", iniciarTreinoAgendado);
router.post("/:id/finish", finalizarTreinoAgendado);

router.get("/:treinoId/status", getTreinoStatus);
router.get("/disponiveis", treinosDisponiveis);

/* ===== UTIL ===== */
router.get("/atletas-vinculados", atletasVinculados);
router.post("/restaurar", restaurarTreinos);
router.get("/exercicios", getExercicios);
router.get("/pontuacoes", getPontuacoes);
router.get("/desafios-semanais", statusDesafiosSemanais);

/* ===== ROTINAS (agendamento em lote) ===== */
router.post(
  "/rotina/agendar",
  requireCapability("agendamento:lote"),
  agendarRotinaMensal
);

router.post(
  "/org/:orgId/rotina/agendar",
  // resolve orgId de param (fallback para body)
  requireOrgSeat(req => (req.params?.orgId as string) || (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  requireCapability("agendamento:lote"),
  agendarRotinaMensal
);

/* aliases / fallback */
router.post(
  "/",
  requireOrgSeat(req => (req.body?.escolinhaId as string) || (req.body?.clubeId as string)),
  criarTreinoProgramado
);
router.get("/", listarTodosTreinosProgramados);

export default router;