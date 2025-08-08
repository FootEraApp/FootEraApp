import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const seguirUsuario = async (req: Request, res: Response) => {
  const { seguidorUsuarioId, seguidoUsuarioId } = req.body;

  try {
    const relacaoExistente = await prisma.seguidor.findFirst({
      where: { seguidorUsuarioId, seguidoUsuarioId },
    });

    if (relacaoExistente) {
      return res.status(400).json({ erro: "Já está seguindo este usuário." });
    }

    const novo = await prisma.seguidor.create({
      data: { seguidorUsuarioId, seguidoUsuarioId },
    });

    res.status(201).json(novo);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao seguir usuário." });
  }
};

export const deixarDeSeguir = async (req: Request, res: Response) => {
  const { seguidorUsuarioId, seguidoUsuarioId } = req.body;

  try {
    await prisma.seguidor.deleteMany({
      where: { seguidorUsuarioId, seguidoUsuarioId },
    });

    res.status(200).json({ mensagem: "Deixou de seguir com sucesso." });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao deixar de seguir usuário." });
  }
};

export const listarSeguindo = async (req: Request, res: Response) => {
  const usuarioId = req.user?.id;

  try {
    const seguindo = await prisma.seguidor.findMany({
      where: {
        seguidorUsuarioId: usuarioId,
      },
      select: {
        seguidoUsuarioId: true,
      },
    });

    const idsSeguidos = seguindo.map((s) => s.seguidoUsuarioId);
    res.json(idsSeguidos);
  } catch (error) {
    console.error("Erro ao listar seguindo:", error);
    res.status(500).json({ error: "Erro ao buscar seguindo" });
  }
};