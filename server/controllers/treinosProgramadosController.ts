import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const createTreinoProgramado = async (req: Request, res: Response) => {
  try {
    const { nome, codigo, nivel, descricao, professorId, exercicios, metas, pontuacao, categoria } = req.body;

    if (!nome || !codigo || !professorId || !Array.isArray(exercicios)) {
      return res.status(400).json({ message: "Dados incompletos" });
    }

    if (!Array.isArray(categoria) || categoria.length === 0) {
      return res.status(400).json({ message: "Pelo menos uma categoria deve ser selecionada." });
    }

    const treinoExistente = await prisma.treinoProgramado.findFirst({
      where: {
        OR: [
          { nome: req.body.nome },
          { codigo: req.body.codigo }
        ]
      }
    });

    if (treinoExistente) {
      return res.status(400).json({ message: "Treino com nome ou código já existe." });
    }

    if (exercicios.some(e => !e.exercicioId)) {
      return res.status(400).json({ message: "Todos os exercícios devem ser selecionados." });
    }

    const treinoCriado = await prisma.treinoProgramado.create({
      data: {
        nome,
        codigo,
        nivel,
        descricao,
        metas,
        pontuacao: pontuacao ? Number(pontuacao) : 5,
        categoria,
        professor: { connect: { id: professorId } },
        exercicios: {
          create: exercicios.map((ex: any) => ({
            ordem: ex.ordem,
            repeticoes: ex.repeticoes,
            exercicio: { connect: { id: ex.exercicioId } },
          })),
        },
      },
      include: {
        professor: { include: { usuario: true } },
        exercicios: { include: { exercicio: true } },
      },
    });

    res.status(201).json(treinoCriado);
  } catch (error: any) {
    console.error("Erro ao criar treino programado:", error);
    res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

export const getTreinoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const treino = await prisma.treinoProgramado.findUnique({
      where: { id },
      include: {
        professor: { include: { usuario: true } },
        exercicios: { include: { exercicio: true } }
      },
    });

    if (!treino) return res.status(404).json({ message: "Treino não encontrado." });
    res.json(treino);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar treino." });
  }
};

export async function updateTreino(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nome, codigo, descricao, nivel, professorId, metas, pontuacao, categoria } = req.body;

    const treinoExistente = await prisma.treinoProgramado.findFirst({
      where: {
        id: { not: id }, 
        OR: [{ nome }, { codigo }]
      }
    });

    if (treinoExistente) {
      return res.status(400).json({ message: 'Já existe um treino com esse nome ou código.' });
    }

    const treino = await prisma.treinoProgramado.update({
      where: { id },
      data: {
        nome,
        codigo,
        descricao,
        nivel,
        professorId,
        metas,
        pontuacao: pontuacao ? Number(pontuacao) : 5,
        categoria
      }
    });

    res.json(treino);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar treino' });
  }
}

export const getAllTreinos = async (req: Request, res: Response) => {
  try {
    const treinos = await prisma.treinoProgramado.findMany({
      include: {
        professor: { include: { usuario: true } },
        exercicios: { include: { exercicio: true } },
      },
    });
    res.json(treinos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar treinos." });
  }
}