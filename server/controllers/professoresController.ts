import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import multer from "multer";

const upload = multer({dest: "uploads/"});

export const listarProfessores = async (req: Request, res: Response) => {
  try {
    const professores = await prisma.professor.findMany({
      include: {
        usuario: true,
      },
    });
    res.json(professores);
  } catch (error) {
    console.error("Erro ao listar professores:", error);
    res.status(500).json({ message: "Erro ao listar professores." });
  }
};

export const buscarProfessorPorId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const professor = await prisma.professor.findUnique({
      where: { id },
      include: {
        usuario: true,
      },
    });
    if (!professor) return res.status(404).json({ message: "Professor não encontrado." });
    res.json(professor);
  } catch (error) {
    console.error("Erro ao buscar professor:", error);
    res.status(500).json({ message: "Erro ao buscar professor." });
  }
};

export const criarProfessor = async (req: Request, res: Response) => {
  try {
    const {
      codigo,
      cref,
      nome,
      areaFormacao,
      usuario,
      statusCref,
    } = req.body;

    let qualificacoes = req.body.qualificacoes;
    let certificacoes = req.body.certificacoes;

    if (typeof qualificacoes === "string") {
      qualificacoes = [qualificacoes];
    }

    if (typeof certificacoes === "string") {
      certificacoes = [certificacoes];
    }

    const data: any = {
      codigo,
      cref,
      nome,
      areaFormacao,
      statusCref,
      qualificacoes,
      certificacoes,
      fotoUrl: req.file?.filename || "",
    };

    if (usuario) {
      data.usuario = usuario;
    }

    const novoProfessor = await prisma.professor.create({ data });

    res.status(201).json(novoProfessor);
  } catch (error) {
    console.error("Erro ao criar professor:", error);
    res.status(500).json({ message: "Erro ao criar professor", error });
  }
};

export const editarProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const {
      codigo,
      cref,
      nome,
      areaFormacao,
      statusCref,
    } = req.body;

    let qualificacoes = req.body["qualificacoes[]"] || req.body.qualificacoes;
    let certificacoes = req.body["certificacoes[]"] || req.body.certificacoes;

    if (typeof qualificacoes === "string") {
      qualificacoes = [qualificacoes];
    }

    if (typeof certificacoes === "string") {
      certificacoes = [certificacoes];
    }

    const data: any = {
      codigo,
      cref,
      nome,
      areaFormacao,
      statusCref,
      qualificacoes,
      certificacoes,
    };

    if (req.file) {
      data.fotoUrl = req.file.filename;
    }

    const professorAtualizado = await prisma.professor.update({
      where: { id },
      data,
    });

    res.json(professorAtualizado);
  } catch (error) {
    console.error("Erro ao editar professor:", error);
    res.status(500).json({ message: "Erro ao editar professor.", error });
  }
};

export const excluirProfessor = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.professor.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir professor:", error);
    res.status(500).json({ message: "Erro ao excluir professor." });
  }
};
