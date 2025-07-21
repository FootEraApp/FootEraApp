import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Nivel, Categoria } from "@prisma/client";

export const createDesafio = async (req: Request, res: Response) => {
  const { titulo, descricao, imagemUrl, nivel, categoria, pontos } = req.body;

  try {
    const desafio = await prisma.desafioOficial.create({
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel: nivel as Nivel,
        categoria: Array.isArray(categoria) ? categoria : [categoria],
        pontos: Number(pontos),
        },
    });
    res.status(201).json(desafio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar desafio." });
  }
};

export const updateDesafio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { titulo, descricao, imagemUrl, nivel, categoria, pontuacao, prazoSubmissao } = req.body;

  try {
    const updated = await prisma.desafioOficial.update({
      where: { id },
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel: nivel as Nivel,
        categoria: categoria as Categoria[],
        pontos: Number(pontuacao),
        },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar desafio." });
  }
};

export const deleteDesafio = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.desafioOficial.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir desafio." });
  }
};

export const getDesafios = async (req: Request, res: Response) => {
  try {
    const desafios = await prisma.desafioOficial.findMany(); 

    res.json(desafios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar desafios." });
  }
};