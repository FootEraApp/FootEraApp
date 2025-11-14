import { Response, RequestHandler, Request } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { getIO } from "../socket.js";
import { getDailyUsage } from "../services/usage.js";

const prisma = new PrismaClient();

const ADS_CAP_PER_DAY = 5;
const AD_EVERY_N = 10;

async function isProUser(userId: string) {
  const assinatura = await prisma.assinatura.findUnique({
    where: { usuarioId: userId },
    select: { ativo: true, plano: true },
  });

  return !!assinatura?.ativo;
}

async function getAdsConfigForUser(userId?: string) {
  if (!userId) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }
    const pro = await isProUser(userId);
  if (pro) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }

  const usedToday = await getDailyUsage(userId, "ads_impressions_day");
  const remaining = Math.max(0, ADS_CAP_PER_DAY - usedToday);

  return {
    adsEnabled: remaining > 0,
    adEveryN: AD_EVERY_N,
    adsRemainingToday: remaining,
  };
}

export const getFeedPosts: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const raw = String(req.query.filtro ?? req.query.filter ?? "todos").toLowerCase();
    const filtro: "todos" | "seguindo" | "favoritos" | "meus" =
      raw === "seguindo" || raw === "favoritos" || raw === "meus" ? (raw as any) : "todos";

    let where: Prisma.PostagemWhereInput = {};

    if (filtro === "meus") {
      if (!userId) {
        // usuário não autenticado → nenhum post e sem ads
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      where = { usuarioId: userId };
    }

    if (filtro === "todos") {
      if (userId) where = { NOT: { usuarioId: userId } };
    }

    if (filtro === "seguindo") {
      if (!userId) {
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      const seguindo = await prisma.seguidor.findMany({
        where: { seguidorUsuarioId: userId },
        select: { seguidoUsuarioId: true },
      });
      const ids = seguindo.map(s => s.seguidoUsuarioId);
      if (ids.length === 0) {
        const ads = await getAdsConfigForUser(userId);
        return res.json({ items: [], meta: ads });
      }
      where = { usuarioId: { in: ids } };
    }

    if (filtro === "favoritos") {
      if (!userId) {
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      const favs = await prisma.favoritoUsuario.findMany({
        where: { usuarioId: userId },
        select: { favoritoUsuarioId: true },
      });
      const ids = favs.map(f => f.favoritoUsuarioId);
      if (ids.length === 0) {
        const ads = await getAdsConfigForUser(userId);
        return res.json({ items: [], meta: ads });
      }
      where = { usuarioId: { in: ids } };
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
        repostOf: {
          include: {
            usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
            curtidas: true,
            comentarios: { include: { usuario: { select: { nome: true, foto: true } } } },
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
    });

    const ads = await getAdsConfigForUser(userId);

    // >>> AQUI entra o formato com meta de ads <<<
    return res.json({
      items: postagens,
      meta: {
        adsEnabled: ads.adsEnabled,
        adEveryN: ads.adsEnabled ? ads.adEveryN : null,
        adsRemainingToday: ads.adsRemainingToday,
      },
    });
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
        comentarios: { include: { usuario: true } },
        curtidas: true,
        repostOf: { 
          include: {
            usuario: true,
            comentarios: { include: { usuario: true } },
            curtidas: true,
          },
        },
      },
    });
    if (!post) return res.status(404).json({ erro: "Post não encontrado" });
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

  const { conteudo, descricao, imagemUrl: imagemUrlBody, videoUrl: videoUrlBody } =
    req.body as { conteudo?: string; descricao?: string; imagemUrl?: string; videoUrl?: string };

  const texto = (descricao && descricao.length ? descricao : conteudo) || "";
  const file = (req as any).file as Express.Multer.File | undefined;

  try {
    let tipoMidia: "Imagem" | "Video" | undefined;
    let imagemUrl: string | undefined;
    let videoUrl: string | undefined;

    if (file) {
      const isVideo = file.mimetype?.startsWith("video");
      const dest = (file.destination || "").replace(/\\/g, "/");
      const leaf = dest.split("/").filter(Boolean).pop() || "";
      if (isVideo) {
        tipoMidia = "Video";
        videoUrl = `/uploads/${leaf}/${file.filename}`;
      } else {
        tipoMidia = "Imagem";
        imagemUrl = `/uploads/${leaf}/${file.filename}`;
      }
    }

    if (!file) {
      const FRONT = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

      const norm = (u?: string): string | undefined => {
        if (!u) return undefined;
        let s = String(u).trim();
        if (!s) return undefined;

        if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;

        if (s.startsWith("uploads/")) s = "/" + s;
        if (s.startsWith("/uploads/")) return s;

        if (s.startsWith("assets/")) s = "/" + s;
        if (s.startsWith("/assets/")) return `${FRONT}${s}`;

        return undefined;
      };

      const img = norm(imagemUrlBody);
      const vid = norm(videoUrlBody);

      if (img) {
        imagemUrl = img;
        tipoMidia = "Imagem";
      }
      if (vid) {
        videoUrl = vid;
        tipoMidia = "Video";
      }
    }

    if (!texto && !imagemUrl && !videoUrl) {
      return res.status(400).json({ message: "Conteúdo ou mídia obrigatória." });
    }

    const postagem = await prisma.postagem.create({
      data: {
        conteudo: texto,
        usuarioId,
        dataCriacao: new Date(),
        tipoMidia,
        imagemUrl,
        videoUrl,
      },
    });

    const postForEmit = await prisma.postagem.findUnique({
      where: { id: postagem.id },
      include: {
        usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
        curtidas: true,
        comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
      },
    });

    const segs = await prisma.seguidor.findMany({
      where: { seguidoUsuarioId: usuarioId! },
      select: { seguidorUsuarioId: true },
    });
    getIO()
      ?.to([`u:${usuarioId}`, ...segs.map(s => `u:${s.seguidorUsuarioId}`)])
      .emit("feed:novoPost", postForEmit);

    return res.status(201).json(postagem);
  } catch (error) {
    console.error("Erro ao postar:", error);
    return res.status(500).json({ message: "Erro interno." });
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

export async function repostPost(req: Request, res: Response) {
  try {
    const postId = String(req.params.id);
    const userId = (req as any).userId as string | undefined;
    const comentario = (req.body?.comentario ?? "").trim();

    if (!userId) return res.status(401).json({ message: "Usuário não autenticado" });

    const original = await prisma.postagem.findUnique({
      where: { id: postId },
      include: {
        usuario: true,
        curtidas: true,
        comentarios: { include: { usuario: true } },
      },
    });
    if (!original) return res.status(404).json({ message: "Post não encontrado" });

    const hidden = "\u200B" + Date.now();
    const novo = await prisma.postagem.create({
      data: {
        usuarioId: userId,
        conteudo: comentario || "" || hidden, 
        repostOfId: original.id,
      },
      include: {
        usuario: true,
        curtidas: true,
        comentarios: { include: { usuario: true } },
        repostOf: {
          include: {
            usuario: true,
            curtidas: true,
            comentarios: { include: { usuario: true } },
          },
        },
      },
    });

    await prisma.postagem.update({
      where: { id: original.id },
      data: { reposts: (original.reposts ?? 0) + 1 },
    });

    getIO()?.emit("feed:novoPost", novo);
    return res.json(novo);
  } catch (e) {
    console.error("Erro ao repostar:", e);
    return res.status(500).json({ message: "Erro ao repostar" });
  }
}