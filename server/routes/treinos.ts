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
} from "server/controllers/treinosController.js";
import { requireElencoOwner } from "server/middlewares/membership.js";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/disponiveis", treinosDisponiveis);
router.get("/atletas-vinculados", atletasVinculados);
router.get("/elencos/:id/escala", requireElencoOwner, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", getEscalaPorDono);
router.get("/elencos", listarElencos);
router.post("/elencos", criarElenco);
router.put("/elencos/:id", requireElencoOwner, atualizarElenco);
router.post("/agendados/:id/iniciar", iniciarTreino);
router.get("/agendados", getTreinosAgendados);
router.post("/agendados", agendarTreino);
router.delete("/agendados/:id", excluirTreinoAgendado);
router.post("/agendados/:id/complete", concluirTreino);
router.get("/minhas-submissoes", listarMinhasSubmissoesTreino);
router.get("/programados/:id", obterTreinoProgramadoPorId);
router.put("/programados/:id", atualizarTreinoProgramado);
router.delete("/programados/:id", deletarTreinoProgramado);
router.get("/programados", listarTodosTreinosProgramados);
router.post("/restaurar", restaurarTreinos);
router.get("/exercicios", getExercicios);
router.get("/pontuacoes", getPontuacoes);
router.get("/submissoes", listarSubmissoesParaValidacao);
router.post("/submissoes/:id/validar", validarSubmissaoTreino);
router.get("/:treinoId/status", async (req: any, res) => {
  const usuarioId = req.userId || req.user?.id;
  const treinoId = String(req.params.treinoId);

  const tu = await prisma.treinoUsuario.findUnique({
    where: { treinoId_usuarioId: { treinoId, usuarioId } },
    select: { status: true, startedAt: true, completedAt: true },
  });

  res.json(tu ?? { status: "PENDING", startedAt: null, completedAt: null });
});
router.delete("/:id", deletarTreinoProgramado);
router.get("/desafios-semanais", statusDesafiosSemanais);
router.get("/", listarTodosTreinosProgramados);
router.post("/", criarTreinoProgramado);

export default router;