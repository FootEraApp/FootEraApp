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

export const getFeed = async (_req: Request, res: Response) => {
  const posts = await prisma.postagem.findMany({
    include: {
      usuario: true,
      curtidas: true,
      comentarios: true,
    },
    orderBy: {
      dataCriacao: "desc",
    },
  });

  res.json(posts);
};

export const curtirPost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const usuarioId = req.headers["usuario-id"] as string; // ou extraído do JWT

  const curtidaExistente = await prisma.curtida.findFirst({
    where: { postagemId: postId, usuarioId },
  });

  if (curtidaExistente) {
    await prisma.curtida.delete({
      where: { id: curtidaExistente.id },
    });
    return res.json({ message: "Curtida removida" });
  }

  await prisma.curtida.create({
    data: {
      postagemId: postId,
      usuarioId,
    },
  });

  res.json({ message: "Curtida adicionada" });
};

export const comentarPost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { conteudo, usuarioId } = req.body;

  if (!conteudo || !usuarioId) {
    return res.status(400).json({ message: "Comentário inválido" });
  }

  const comentario = await prisma.comentario.create({
    data: {
      conteudo,
      postagemId: postId,
      usuarioId,
    },
  });

  res.status(201).json(comentario);
};

export const criarPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const { videoUrl, tipoMidia, conteudo, imagemUrl } = req.body;
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  try {
    const novaPostagem = await prisma.postagem.create({
      data: {
        conteudo,
        imagemUrl,
        usuarioId,
        videoUrl,
        tipoMidia
      },
    });

    res.status(201).json(novaPostagem);
  } catch (err) {
    console.error("Erro ao criar postagem:", err);
    res.status(500).json({ message: "Erro ao criar a postagem" });
  }
};

