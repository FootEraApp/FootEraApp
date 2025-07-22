import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { undefined } from "zod";

export async function listarDesafios(req: Request, res: Response) {
  const desafios = await prisma.desafioOficial.findMany();
  res.json(desafios);
}

export async function buscarDesafioPorId(req: Request, res: Response) {
  const { id } = req.params;
  const desafio = await prisma.desafioOficial.findUnique({ where: { id } });
  if (!desafio) return res.status(404).json({ message: "Desafio não encontrado." });
  res.json(desafio);
}

export async function criarDesafio(req: Request, res: Response) {
  try {
    const {
      titulo,
      descricao,
      imagemUrl,
      nivel,
      pontuacao,
      categorias,
    } = req.body;

    if (!titulo || !descricao || !nivel || !pontuacao || !categorias ) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    const desafio = await prisma.desafioOficial.create({
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel,
        pontos: Number(pontuacao),
        categoria: categorias, 
         },
    });

    res.status(201).json(desafio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar desafio." });
  }
}

export async function editarDesafio(req: Request, res: Response) {
  const { id } = req.params;
  const { titulo, descricao, pontos, categoria } = req.body;
  const desafio = await prisma.desafioOficial.update({
    where: { id },
    data: { titulo, descricao, pontos, categoria }
  });
  res.json(desafio);
}

export async function excluirDesafio(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.desafioOficial.delete({ where: { id } });
  res.status(204).send();
}
