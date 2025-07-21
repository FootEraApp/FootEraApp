import { Response } from "express";
import { PrismaClient, TipoMidia } from "@prisma/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { AuthenticatedRequest } from "../types/auth"; 

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

