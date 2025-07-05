// server/controllers/feedController.ts
import { Response } from "express";
import { PrismaClient, TipoMidia } from "@prisma/client";
import path from "path";
import fs from "fs";
import { AuthenticatedRequest } from "../types/auth"; // definiremos isso abaixo

const prisma = new PrismaClient();

export const getFeed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

    const seguidos = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: usuarioId },
      select: { seguidoUsuarioId: true },
    });

    const ids = seguidos.map(s => s.seguidoUsuarioId);
    ids.push(usuarioId);

    const postagens = await prisma.postagem.findMany({
      where: { usuarioId: { in: ids } },
      include: {
        usuario: true,
        comentarios: { include: { usuario: true } },
        curtidas: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    res.json(postagens);
  } catch (error) {
    console.error("Erro no feed:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const curtirPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;
  const { postagemId } = req.body;
  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

  try {
    const curtidaExistente = await prisma.curtida.findFirst({
      where: { usuarioId, postagemId },
    });

    if (curtidaExistente) {
      await prisma.curtida.delete({ where: { id: curtidaExistente.id } });
    } else {
      await prisma.curtida.create({ data: { usuarioId, postagemId } });
    }

    const total = await prisma.curtida.count({ where: { postagemId } });
    res.json({ sucesso: true, curtidas: total });
  } catch (error) {
    console.error("Erro ao curtir:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const comentarPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;
  const { postagemId, conteudo } = req.body;
  if (!usuarioId || !conteudo) return res.status(400).json({ message: "Dados inválidos." });

  try {
    await prisma.comentario.create({
      data: { conteudo, usuarioId, postagemId },
    });

    res.status(201).json({ message: "Comentário adicionado." });
  } catch (error) {
    console.error("Erro ao comentar:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const seguirUsuario = async (req: AuthenticatedRequest, res: Response) => {
  const seguidorUsuarioId = req.userId;
  const { seguidoUsuarioId } = req.body;
  if (!seguidorUsuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

  try {
    const existente = await prisma.seguidor.findFirst({
      where: { seguidorUsuarioId, seguidoUsuarioId },
    });

    if (existente) {
      await prisma.seguidor.delete({ where: { id: existente.id } });
    } else {
      await prisma.seguidor.create({ data: { seguidorUsuarioId, seguidoUsuarioId } });
    }

    const isFollowing = await prisma.seguidor.findFirst({
      where: { seguidorUsuarioId, seguidoUsuarioId },
    });

    res.json({ success: true, isFollowing: !!isFollowing });
  } catch (error) {
    console.error("Erro ao seguir:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const postar = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

  const { conteudo } = req.body;
  const file = (req as any).file;

  try {
    const postagem = await prisma.postagem.create({
      data: {
        conteudo,
        usuarioId,
        dataCriacao: new Date(),
        tipoMidia: file ? (file.mimetype.startsWith("video") ? "Video" : "Imagem") as TipoMidia : undefined,
        imagemUrl: file ? `/uploads/posts/${file.filename}` : undefined,
      },
    });

    res.status(201).json(postagem);
  } catch (error) {
    console.error("Erro ao postar:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const deletarPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;
  const postId = req.params.id;

  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

  try {
    const post = await prisma.postagem.findUnique({ where: { id: postId } });

    if (!post || post.usuarioId !== usuarioId) {
      return res.status(403).json({ message: "Não autorizado." });
    }

    if (post.imagemUrl) {
      const fullPath = path.join(__dirname, `../../public${post.imagemUrl}`);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await prisma.postagem.delete({ where: { id: postId } });
    res.json({ message: "Postagem deletada." });
  } catch (error) {
    console.error("Erro ao deletar postagem:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};
