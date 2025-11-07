// server/routes/treinos
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
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/elencos/:id/escala", requireElencoOwner, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", getEscalaPorDono);
router.get("/elencos", listarElencos);
router.post("/elencos", criarElenco);
router.put("/elencos/:id", requireElencoOwner, atualizarElenco);

router.post("/agendados/:id/iniciar", iniciarTreino);
router.delete("/agendados/:id", excluirTreinoAgendado);
router.post("/agendados/:id/complete", concluirTreino);
router.get("/agendados", getTreinosAgendados);
router.post("/agendados", agendarTreino);

router.get("/programados/:id", obterTreinoProgramadoPorId);
router.put("/programados/:id", atualizarTreinoProgramado);
router.delete("/programados/:id", deletarTreinoProgramado);
router.get("/programados", listarTodosTreinosProgramados);

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
router.post("/rotina/agendar", agendarRotinaMensal);
router.post("/cron/expirar", expirarTreinosVencidos);

router.get("/", listarTodosTreinosProgramados);
router.post("/", criarTreinoProgramado);

export default router;