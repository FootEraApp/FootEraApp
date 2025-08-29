// server/controllers/feedController
import { Response, RequestHandler } from "express";
import { Request } from "express";
import { TipoMidia, Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export const getFeedPosts: RequestHandler = async (req, res) => {
  try {
    const userId: string | undefined = (req as any).userId;
    const raw = String(req.query.filtro ?? req.query.filter ?? "todos").toLowerCase();
    const filtro: "todos" | "seguindo" | "favoritos" | "meus" =
      raw === "seguindo" || raw === "favoritos" || raw === "meus" ? raw : "todos";

    const where: Prisma.PostagemWhereInput = {};

    if (filtro === "meus") {
      if (!userId) return res.status(401).json({ message: "Requer login." });
      where.usuarioId = userId;
    }

    if (filtro === "seguindo") {
      if (!userId) return res.status(401).json({ message: "Requer login." });
      const seg = await prisma.seguidor.findMany({
        where: { seguidorUsuarioId: userId },
        select: { seguidoUsuarioId: true },
      });
      const ids = seg.map(s => s.seguidoUsuarioId);
      if (ids.length === 0) {
        return res.json([]); 
      }
      where.AND = [{ usuarioId: { in: ids } }, { usuarioId: { not: userId } }];
    }

    if (filtro === "favoritos") {
      if (!userId) return res.status(401).json({ message: "Requer login." });

      const favs = await prisma.favoritoUsuario.findMany({
        where: { usuarioId: userId },
        select: { favoritoUsuarioId: true },
      });

      const ids = favs.map(f => f.favoritoUsuarioId).filter(Boolean);
      if (ids.length === 0) return res.json([]);

      where.AND = [{ usuarioId: { in: ids } }, { usuarioId: { not: userId } }];
    }

    if (filtro === "todos") {
      if (userId) where.usuarioId = { not: userId };
    }

    const postagens = await prisma.postagem.findMany({
      where,
      include: {
        usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
        curtidas: { select: { usuarioId: true } },
        comentarios: {
          orderBy: { dataCriacao: "asc" },
          include: { usuario: { select: { nome: true, foto: true } } },
        },
      },
      orderBy: { dataCriacao: "desc" },
    });

    return res.json(postagens);
  } catch (error) {
    console.error("Erro ao buscar feed:", error);
    return res.status(500).json({ message: "Erro ao buscar postagens." });
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

export const curtirPostagem: RequestHandler = async (req, res) => {
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

export const seguirUsuario: RequestHandler = async (req, res) => {
  const seguidorUsuarioId = req.userId!;
  const { seguidoUsuarioId } = req.body as { seguidoUsuarioId?: string };

  if (!seguidoUsuarioId)
    return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  if (seguidoUsuarioId === seguidorUsuarioId)
    return res.status(400).json({ message: "Não é permitido seguir a si mesmo." });

  const jaSegue = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId, seguidoUsuarioId },
  });
  if (jaSegue) return res.status(409).json({ message: "Você já segue este usuário." });

  await prisma.seguidor.create({ data: { seguidorUsuarioId, seguidoUsuarioId } });
  res.sendStatus(201);
};

export const postar: RequestHandler = async (req, res) => {
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

export const deletarPostagem: RequestHandler = async (req, res) => {
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

export const getPerfil: RequestHandler = async (req, res) => {
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

export const deletarUsuario: RequestHandler = async (req, res) => {
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
