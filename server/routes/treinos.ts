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
} from "server/controllers/treinosController.js";
import { requireElencoOwner } from "server/middlewares/membership.js";
import { PrismaClient, TreinoStatus } from "@prisma/client";
import { sanitizeText, basicModerationFails } from "../utils/moderation.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticateToken);

router.get("/disponiveis", treinosDisponiveis);

router.get("/atletas-vinculados", atletasVinculados);

router.post("/agendados/:id/iniciar", authenticateToken, iniciarTreino); 
router.get("/agendados", authenticateToken, getTreinosAgendados);
router.post("/agendados", authenticateToken, agendarTreino);
router.delete("/agendados/:id", authenticateToken, excluirTreinoAgendado);
router.post("/agendados/:id/complete", authenticateToken, concluirTreino);


router.get("/minhas-submissoes", authenticateToken, listarMinhasSubmissoesTreino);

router.get("/programados/:id", authenticateToken, obterTreinoProgramadoPorId);
router.put("/programados/:id", authenticateToken, atualizarTreinoProgramado);
router.delete("/programados/:id", authenticateToken, deletarTreinoProgramado);
router.get("/programados", listarTodosTreinosProgramados);
router.post("/restaurar", authenticateToken, restaurarTreinos);
router.post("/", criarTreinoProgramado);

router.get("/exercicios", getExercicios);
router.get("/pontuacoes", authenticateToken, getPontuacoes);

router.get("/submissoes", authenticateToken, listarSubmissoesParaValidacao);
router.post("/submissoes/:id/validar", authenticateToken, validarSubmissaoTreino);

router.get("/elencos/:id/escala", authenticateToken, requireElencoOwner, getEscalaPorElencoId);
router.get("/elencos/escala-por-dono", authenticateToken, getEscalaPorDono);
router.get("/elencos", authenticateToken, listarElencos);
router.post("/elencos", authenticateToken, criarElenco);
router.put("/elencos/:id", authenticateToken, requireElencoOwner, atualizarElenco);

router.get("/:treinoId/status", async (req: any, res) => {
  const usuarioId = req.userId || req.user?.id;
  const treinoId = String(req.params.treinoId);

  const tu = await prisma.treinoUsuario.findUnique({
    where: { treinoId_usuarioId: { treinoId, usuarioId } },
    select: { status: true, startedAt: true, completedAt: true },
  });

  res.json(tu ?? { status: "PENDING", startedAt: null, completedAt: null });
});

router.get("/", listarTodosTreinosProgramados);                 
router.delete("/:id", authenticateToken, deletarTreinoProgramado);

export default router;