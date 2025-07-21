import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllAtletas = async (_req: Request, res: Response) => {
  const atletas = await prisma.atleta.findMany({
    include: { usuario: true, midias: true, postagens: true }
  });
  res.json(atletas);
};

export const getAtletaById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const atleta = await prisma.atleta.findUnique({
    where: { id },
    include: {
      usuario: {
        include: { seguidores: true, seguindo: true }
      },
      midias: true,
      postagens: {
        orderBy: { dataCriacao: "desc" },
        take: 5
      },
      clube: true,
      escolinha: true
    }
  });

  if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });
  res.json(atleta);
};

export const createAtleta = async (req: Request, res: Response) => {
  try {
    const {
      nomeDeUsuario,
      senha,
      nome,
      email,
      ...atletaDados
    } = req.body;

    const bcrypt = await import("bcryptjs");
    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nomeDeUsuario,
        senhaHash,
        nome,
        email,
        tipo: "Atleta"
      }
    });

    const atleta = await prisma.atleta.create({
      data: {
        usuarioId: usuario.id,
        ...atletaDados
      }
    });

    res.status(201).json({ usuario, atleta });
  } catch (error) {
    console.error("Erro ao criar atleta:", error);
    res.status(500).json({ error: "Erro interno ao criar atleta" });
  }
};

export const updateAtleta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const atleta = await prisma.atleta.update({
      where: { id },
      data: {
        ...data,
        dataUltimaModificacao: new Date()
      }
    });

    res.json(atleta);
  } catch (error) {
    console.error("Erro ao atualizar atleta:", error);
    res.status(500).json({ error: "Erro interno ao atualizar atleta" });
  }
};

export const deleteAtleta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.atleta.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao deletar atleta:", error);
    res.status(500).json({ error: "Erro interno ao deletar atleta" });
  }
};

export const getMidiasAtleta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const midias = await prisma.midia.findMany({
    where: { atletaId: id }
  });
  res.json(midias);
};

export const uploadMidiaAtleta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, tipo, titulo, descricao } = req.body;

  const midia = await prisma.midia.create({
    data: {
      atletaId: id,
      url,
      tipo,
      titulo,
      descricao,
      dataEnvio: new Date()
    }
  });

  res.status(201).json(midia);
};
