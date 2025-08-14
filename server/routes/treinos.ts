import { Router } from "express";
import { Nivel, Categoria, TipoTreino } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "server/middlewares/auth";
import { obterTreinoProgramadoPorId, listarTreinosAgendados, treinosController, excluirTreinoAgendado, listarTodosTreinosProgramados } from "../controllers/treinosController";
const router = Router();

interface CriarTreinoInput {
  nome: string;
  descricao?: string;
  nivel: Nivel;
  categoria?: Categoria[];
  tipoTreino?: string;
  objetivo?: string;
  duracao?: number;
  dataTreino?: string;
  dicas?: string[];
  exercicios: {
    exercicioId?: string;
    nome?: string;
    descricao?: string;
    series?: string;
    repeticoes: string;
  }[];
  tipoUsuarioId: string; 
}

router.delete('/agendados/:id', authenticateToken, excluirTreinoAgendado);
router.get("/agendados", authenticateToken, listarTreinosAgendados);
router.get("/disponiveis", treinosController.disponiveis);
router.post("/agendar", authenticateToken, treinosController.agendarTreino);
router.get("/todos", listarTodosTreinosProgramados);
router.get("/exercicios", async (req, res) => {
  try {
    const exercicios = await prisma.exercicio.findMany();
    return res.json(exercicios);
  } catch (err) {
    console.error("Erro ao buscar exercícios:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/atletas-vinculados", async (req, res) => {
  const { tipoUsuarioId } = req.query;

  if (!tipoUsuarioId || typeof tipoUsuarioId !== "string") {
    return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
  }

  try {
    const relacoes = await prisma.relacaoTreinamento.findMany({
      where: {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId }
        ]
      },
      include: {
        atleta: {
          include: {
            usuario: true
          }
        }
      }
    });

    const atletas = relacoes
      .map((rel) => rel.atleta?.usuario)
      .filter((u) => u != null);

    return res.json(atletas);
  } catch (error) {
    console.error("Erro ao buscar atletas vinculados:", error);
    return res.status(500).json({ error: "Erro ao buscar atletas vinculados" });
  }
});
router.get("/", async (req, res) => {
  try {
    const treinosProgramados = await prisma.treinoProgramado.findMany({
      include: {
        exercicios: {
          include: { exercicio: true }
        }
      }
    });

    const desafiosOficiais = await prisma.desafioOficial.findMany();

    const treinosFormatados = treinosProgramados.map((t) => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      nivel: t.nivel,
      dataAgendada: t.dataAgendada,
      professorId: t.professorId, 
      exercicios: t.exercicios.map((ex) => ({
        id: ex.exercicioId,
        nome: ex.exercicio.nome,
        repeticoes: ex.repeticoes
      }))
    }));

    return res.json({ treinosProgramados: treinosFormatados, desafiosOficiais });
  } catch (err) {
    console.error("Erro ao buscar treinos:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.post("/", async (req, res) => {
  const {
    nome,
    descricao,
    nivel,
    exercicios,
    usuarioId,
    categoria,
    tipoTreino,
    objetivo,
    duracao,
    dataTreino,
    dicas,
    tipoUsuario,
    tipoUsuarioId, 
  } = req.body;

   if (!nome || !nivel || !Array.isArray(exercicios) || !usuarioId || !tipoUsuarioId) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  if (
    categoria &&
    (!Array.isArray(categoria) ||
      !categoria.every((cat) => Object.values(Categoria).includes(cat as Categoria)))
  ) {
    return res.status(400).json({ error: "Categoria(s) inválida(s)" });
  }

  if (tipoTreino && !Object.values(TipoTreino).includes(tipoTreino as TipoTreino)) {
    return res.status(400).json({ error: "TipoTreino inválido" });
  }

  try {
    const dataCreate: any = {
      nome,
      descricao,
      nivel,
      codigo: `${nome}-${Date.now()}`,
      dataAgendada: dataTreino ? new Date(dataTreino) : undefined,
      objetivo,
      duracao,
      dicas,
      categoria: Array.isArray(categoria) ? (categoria as Categoria[]) : [],
      tipoTreino: tipoTreino as TipoTreino,
      exercicios: {
        create: exercicios
          .filter((ex) => ex.exercicioId)
          .map((ex, index) => ({
            exercicioId: ex.exercicioId!,
            repeticoes: ex.repeticoes,
            ordem: index + 1
          }))
      }
    };

    if (tipoUsuario === "professor") {
      dataCreate.professorId = tipoUsuarioId;
    } else if (tipoUsuario === "escolinha") {
      dataCreate.escolinhaId = tipoUsuarioId;
    } else if (tipoUsuario === "clube") {
      dataCreate.clubeId = tipoUsuarioId;
    }

    const treino = await prisma.treinoProgramado.create({
      data: dataCreate,
    });

    if (Array.isArray(req.body.atletasIds) && req.body.atletasIds.length > 0) {
      const dataAgendada = treino.dataAgendada ?? new Date();

      await Promise.all(
        req.body.atletasIds.map((atletaId: string) => {
          return prisma.treinoAgendado.create({
            data: {
              titulo: treino.nome,
              dataHora: dataAgendada,
              dataTreino: dataAgendada,
              atletaId,
              treinoProgramadoId: treino.id,
            }
          });
        })
      );
    }
    return res.status(201).json(treino);
  } catch (err) {
    console.error("Erro ao criar treino:", err);
    return res.status(500).json({ error: "Erro ao criar treino" });
  }
});

router.get("/:id", authenticateToken, obterTreinoProgramadoPorId);

export default router;