import { Response } from "express";
import { prisma } from "server/lib/prisma";
import { Request } from "express";
import { TipoMidia } from "@prisma/client";
import { AuthenticatedRequest } from "../types/auth"; 


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

export async function getPostById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const post = await prisma.postagem.findUnique({
      where: { id },
      include: {
        usuario: true,
        comentarios: {
          include: { usuario: true },
        },
        curtidas: true,
      },
    });

    if (!post) {
      return res.status(404).json({ erro: "Post não encontrado" });
    }

    return res.json(post);
  } catch (error) {
    console.error("Erro ao buscar post:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar o post" });
  }
}

export const curtirPostagem = async (req: AuthenticatedRequest, res: Response) => {
  const { postId } = req.params;
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  try {
    const curtidaExistente = await prisma.curtida.findFirst({
      where: {
        postagemId: postId,
        usuarioId,
      },
    });

    if (curtidaExistente) {
      await prisma.curtida.delete({
        where: { id: curtidaExistente.id },
      });
      return res.json({ message: "Curtida removida" });
    } else {
      await prisma.curtida.create({
        data: {
          postagemId: postId,
          usuarioId,
        },
      });
      return res.json({ message: "Curtida adicionada" });
    }
  } catch (error) {
    console.error("Erro ao curtir post:", error);
    return res.status(500).json({ error: "Erro interno ao curtir post" });
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
  const { id } = req.params;
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ mensagem: "Usuário não autenticado." });
  }

  try {
    const post = await prisma.postagem.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ mensagem: "Postagem não encontrada." });
    }

    if (post.usuarioId !== usuarioId) {
      return res.status(403).json({ mensagem: "Não autorizado a excluir esta postagem." });
    }

    await prisma.postagem.delete({ where: { id } });
    res.json({ mensagem: "Postagem excluída com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensagem: "Erro ao excluir postagem." });
  }
};

export const getPerfil = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        email: true,
        foto: true,
        tipo: true,
        cidade: true,
        estado: true,
        pais: true,
        postagens: true,
        seguidores: true,
        seguindo: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.json(usuario);
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    res.status(500).json({ message: "Erro interno ao buscar perfil." });
  }
};

export const deletarUsuario = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await prisma.seguidor.deleteMany({
      where: {
        OR: [
          { seguidorUsuarioId: id },
          { seguidoUsuarioId: id },
        ],
      },
    });

    await prisma.postagem.deleteMany({ where: { usuarioId: id } });

    await prisma.usuario.delete({ where: { id } });

    res.json({ message: "Usuário deletado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ message: "Erro interno ao deletar usuário." });
  }
};
