import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Nivel, Categoria } from "@prisma/client";

type CriarDesafioBody = {
  titulo: string;
  descricao: string;
  imagemUrl?: string;
  nivel: Nivel;
  pontos: number;
  categoria: Categoria[];
  prazoSubmissao?: string; 
};

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

export async function criarDesafio(req: Request<{}, {}, CriarDesafioBody>, res: Response) {
  try {
    const {
      titulo,
      descricao,
      imagemUrl,
      nivel,
      pontos,
      categoria,
      prazoSubmissao
    } = req.body;

    if (!titulo || !descricao || !nivel || !pontos || !categoria?.length) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    let dataPrazo: Date | undefined = undefined;
    if (prazoSubmissao) {
      const parsedDate = new Date(prazoSubmissao);
      if (!isNaN(parsedDate.getTime())) {
        dataPrazo = parsedDate;
      } else {
        return res.status(400).json({ error: "Data inválida para prazo de submissão." });
      }
    }

    const desafio = await prisma.desafioOficial.create({
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel,
        pontos: Number(pontos),
        categoria,
        prazoSubmissao: dataPrazo
      }
    });

    res.status(201).json(desafio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar desafio." });
  }
}

export async function editarDesafio(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      titulo,
      descricao,
      imagemUrl,
      nivel,
      pontos,
      categoria,
      prazoSubmissao
    } = req.body;

    const dataPrazo = prazoSubmissao ? new Date(prazoSubmissao) : undefined;

    const desafio = await prisma.desafioOficial.update({
      where: { id },
      data: {
        titulo,
        descricao,
        imagemUrl,
        nivel,
        pontos: Number(pontos),
        categoria,
        prazoSubmissao: dataPrazo
      }
    });

    res.json(desafio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao editar desafio." });
  }
}

export async function excluirDesafio(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.desafioOficial.delete({ where: { id } });
  res.status(204).send();
}
