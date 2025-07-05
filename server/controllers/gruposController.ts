// server/controllers/gruposController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/grupos
export const getGrupos = async (_req: Request, res: Response) => {
  try {
    const grupos = await prisma.grupo.findMany({
      orderBy: { nome: "asc" }
    });
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar grupos." });
  }
};

// GET /api/grupos/:id
export const getGrupoById = async (req: Request, res: Response) => {
  try {
    const grupo = await prisma.grupo.findUnique({
      where: { id: req.params.id },
      include: {
        membros: {
          include: {
            atleta: {
              include: {
                usuario: true
              }
            }
          }
        }
      }
    });
    if (!grupo) return res.status(404).json({ message: "Grupo não encontrado" });
    res.json(grupo);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar grupo." });
  }
};

// POST /api/grupos
export const createGrupo = async (req: Request, res: Response) => {
  const { nome, descricao, criadorId } = req.body;

  if (!nome || !criadorId) {
    return res.status(400).json({ message: "Nome e criadorId são obrigatórios." });
  }

  try {
    const grupo = await prisma.grupo.create({
      data: {
        nome,
        descricao,
        membros: {
          create: {
            atleta: {
              connect: { id: criadorId }
            }
          }
        }
      },
      include: {
        membros: true
      }
    });

    res.status(201).json(grupo);
  } catch (err) {
    console.error("Erro ao criar grupo:", err);
    res.status(500).json({ message: "Erro interno ao criar grupo." });
  }
};

// POST /api/grupos/:id/membros
export const adicionarMembro = async (req: Request, res: Response) => {
  const grupoId = req.params.id;
  const { atletaId } = req.body;

  try {
    const jaExiste = await prisma.membroGrupo.findFirst({
      where: { grupoId, atletaId }
    });

    if (jaExiste) return res.status(409).json({ message: "Atleta já é membro do grupo." });

    const membro = await prisma.membroGrupo.create({
      data: {
        grupo: {
          connect: { id: grupoId }
        },
        atleta: {
          connect: { id: atletaId }
        }
      }
    });

    res.status(201).json(membro);
  } catch (err) {
    console.error("Erro ao adicionar membro:", err);
    res.status(500).json({ message: "Erro interno." });
  }
};

// DELETE /api/grupos/:id/membros/:atletaId
export const removerMembro = async (req: Request, res: Response) => {
  const { id: grupoId, atletaId } = req.params;

  try {
    const membro = await prisma.membroGrupo.findFirst({
      where: { grupoId, atletaId }
    });

    if (!membro) return res.status(404).json({ message: "Membro não encontrado." });

    await prisma.membroGrupo.delete({
      where: { id: membro.id }
    });

    res.status(204).end();
  } catch (err) {
    console.error("Erro ao remover membro:", err);
    res.status(500).json({ message: "Erro interno." });
  }
};
