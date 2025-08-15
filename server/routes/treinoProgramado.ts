import { Router } from "express";
import { PrismaClient, Categoria, Nivel } from "@prisma/client";
import { getAllTreinos } from "../controllers/treinosProgramadosController.js";

const prisma = new PrismaClient({
  log: ["query","error","warn","info"], 
});
const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      codigo, nome, descricao, nivel, professorId,
      metas, pontuacao, categoria, exercicios,
    } = req.body;

    const novo = await prisma.treinoProgramado.create({
      data: {
        codigo,
        nome,
        descricao,
        nivel: nivel as Nivel,
        professorId,
        metas,
        pontuacao,
        categoria: (categoria ?? []) as Categoria[],
        exercicios: {
          create: (exercicios ?? []).map((e: any, i: number) => ({
            exercicioId: e.exercicioId,
            ordem: e.ordem ?? i + 1,
            repeticoes: e.repeticoes ?? "",
          })),
        },
      },
    });

    return res.status(201).json(novo);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao criar treino" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    codigo, nome, descricao, nivel, professorId,
    metas, pontuacao, categoria, exercicios = [],
  } = req.body;

  const itens = (exercicios as any[]).map((e: any, i: number) => ({
    exercicioId: e.exercicioId ?? e.id,
    ordem: Number(e.ordem ?? i + 1),
    repeticoes: String(e.repeticoes ?? ""),
  }));

  console.log("PUT /treinosprogramados/:id", { id, itensCount: itens.length });

  try {
    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.update({
        where: { id },
        data: {
          codigo,
          nome,
          descricao,
          nivel: nivel as Nivel,
          professorId,
          metas,
          pontuacao,
          categoria: { set: (categoria ?? []) as Categoria[] },
          exercicios: { create: itens },
        },
      }),
    ]);

    res.setHeader("X-TPR-Handler", "treinosprogramados.put.v1");
    return res.json({ ok: true, marker: "TPR-UPDATE-1" });
  } catch (e) {
    console.error("ERRO PUT treinosprogramados:", e);
    res.status(500).json({ message: "Erro ao atualizar treino" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const treino = await prisma.treinoProgramado.findUnique({
    where: { id },
    include: {
      exercicios: {
        select: { exercicioId: true, ordem: true, repeticoes: true },
      },
    },
  });
  if (!treino) return res.status(404).json({ message: "Treino não encontrado" });
  res.json(treino);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction([
      prisma.treinoProgramadoExercicio.deleteMany({ where: { treinoProgramadoId: id } }),
      prisma.treinoProgramado.delete({ where: { id } }),
    ]);
    return res.status(200).json({ message: "Treino excluído" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao excluir treino" });
  }
});

router.get("/", getAllTreinos);

export default router;