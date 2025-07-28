import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth";
import { prisma } from "../lib/prisma"


export const postarConteudo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }
    const userId = req.userId;
    const { descricao, tipoMidia } = req.body;
    const arquivo = req.file;

    if (!descricao && !arquivo) {
      return res.status(400).json({ message: "Descrição ou mídia obrigatória." });
    }

    let imagemUrl: string | null = null;
    let videoUrl: string | null = null;

    if (arquivo) {
      const caminho = `/uploads/${arquivo.filename}`;
      if (tipoMidia === "Imagem") imagemUrl = caminho;
      else if (tipoMidia === "Video") videoUrl = caminho;
    }

    const novaPostagem = await prisma.postagem.create({
      data: {
        conteudo: descricao,
        tipoMidia,
        imagemUrl,
        videoUrl,
        usuarioId: userId,
      },
    });

    return res.status(201).json({ message: "Postagem criada com sucesso.", post: novaPostagem });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao criar postagem." });
  }
};

export async function adicionarComentario(req: Request, res: Response) {
  const { postId } = req.params;
  const { conteudo } = req.body;
  const userId = (req as any).userId;

  if (!userId) return res.status(401).json({ message: "Usuário não autenticado" });

  if (!conteudo || conteudo.trim() === "") {
    return res.status(400).json({ message: "Conteúdo do comentário é obrigatório" });
  }

  try {
    const novoComentario = await prisma.comentario.create({
      data: {
        conteudo,
        postagemId: postId,
        usuarioId: userId,
      },
    });
    return res.status(201).json(novoComentario);
  } catch (error) {
    console.error("Erro ao adicionar comentário:", error);
    return res.status(500).json({ message: "Erro interno ao adicionar comentário" });
  }
}



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