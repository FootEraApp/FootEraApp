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

const router = Router();
const prisma = new PrismaClient();
router.use(authenticateToken);

router.get("/disponiveis", treinosDisponiveis);

router.get("/atletas-vinculados", atletasVinculados);

router.post("/agendados/:id/iniciar", authenticateToken, iniciarTreino); 
router.get("/agendados", authenticateToken, getTreinosAgendados);
router.post("/agendados", authenticateToken, agendarTreino);
router.delete("/agendados/:id", authenticateToken, excluirTreinoAgendado);
router.post("/concluir", authenticateToken, concluirTreino);

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

router.post("/:treinoId/start", async (req: any, res) => {
  const usuarioId = req.userId || req.user?.id;
  const treinoId = String(req.params.treinoId);

  try {
    const tu = await prisma.treinoUsuario.upsert({
      where: { treinoId_usuarioId: { treinoId, usuarioId } },
      update: { status: TreinoStatus.IN_PROGRESS, startedAt: new Date() },
      create: {
        treinoId,
        usuarioId,
        status: TreinoStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
    res.json({ ok: true, status: tu.status, startedAt: tu.startedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Não foi possível iniciar o treino." });
  }
});

router.post("/:treinoId/complete", async (req: any, res) => {
  const usuarioId = req.userId || req.user?.id;
  const treinoId = String(req.params.treinoId);
  const { tempoSeg, repeticoes, duracaoMinutos, observacao } = req.body || {};

  try {
    await prisma.treinoUsuario.update({
      where: { treinoId_usuarioId: { treinoId, usuarioId } },
      data: { status: TreinoStatus.COMPLETED, completedAt: new Date(), tempoSeg, repeticoes, observacao },
    }).catch(async () => {
      await prisma.treinoUsuario.create({
        data: {
          treinoId,
          usuarioId,
          status: TreinoStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
          tempoSeg, repeticoes, observacao,
        },
      });
    });

    await prisma.submissaoTreino.create({
      data: {
        atletaId: usuarioId,              
        treinoAgendadoId: treinoId,      
        duracaoMinutos: duracaoMinutos ?? null,
        tempoSeg: typeof tempoSeg === "number" ? tempoSeg : null,
        repeticoes: typeof repeticoes === "number" ? repeticoes : null,
        observacao: observacao ?? null,
        pontosCreditados: null,          
        pontuacaoSnapshot: null,
      },
    }).catch(() => { });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Não foi possível concluir o treino." });
  }
});

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