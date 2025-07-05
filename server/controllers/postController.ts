// server/controllers/postController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth";

const prisma = new PrismaClient();

export const editarPostagemGet = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const postagem = await prisma.postagem.findUnique({ where: { id } });
    if (!postagem || postagem.usuarioId !== userId) {
      return res.status(401).json({ message: "Você não tem permissão para editar esta postagem." });
    }
    return res.json(postagem);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar postagem." });
  }
};

export const editarPostagemPost = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { conteudo } = req.body;
  const userId = req.userId;

  try {
    const postagem = await prisma.postagem.findUnique({ where: { id } });
    if (!postagem || postagem.usuarioId !== userId) {
      return res.status(401).json({ message: "Você não tem permissão para editar esta postagem." });
    }

    if (!conteudo) {
      return res.status(400).json({ message: "O conteúdo não pode estar vazio." });
    }

    await prisma.postagem.update({
      where: { id },
      data: { conteudo }
    });

    return res.json({ message: "Postagem atualizada com sucesso." });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao editar postagem." });
  }
};

export const deletarPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const { postagemId } = req.params;
  const userId = req.userId;

  try {
    const postagem = await prisma.postagem.findUnique({
      where: { id: postagemId },
      include: { usuario: true }
    });

    if (!postagem) return res.status(404).json({ message: "Postagem não encontrada." });
    if (postagem.usuarioId !== userId) return res.status(401).json({ message: "Não autorizado." });

    await prisma.postagem.delete({ where: { id: postagemId } });
    return res.json({ message: "Postagem deletada com sucesso." });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao deletar postagem." });
  }
};
