import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import fs from "fs/promises";
import path from "path";

type AuthedReq = Request & { userId?: string };

// aceita http(s), /uploads e legado /assets
function isAllowedUrl(u?: string | null) {
  if (!u) return false;
  const s = u.trim();
  return /^https?:\/\//i.test(s) || s.startsWith("/uploads/") || s.startsWith("/assets/");
}

// normaliza qqr entrada p/ salvar consistente
function normalizeIncomingUrl(u: string, req: Request): string {
  let s = (u || "").trim();
  if (!s) return "";

  // legado -> uploads
  s = s.replace(/\/assets\/usuarios\//g, "/uploads/").replace(/^\/assets\//, "/uploads/");

  // se já é relativo válido
  if (s.startsWith("/uploads/")) return s;

  // absoluto: se for do mesmo host (ou tiver caminho /uploads), guarde relativo
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const sameHost = url.host === (req.headers.host || "");
      if (url.pathname.startsWith("/uploads/")) return url.pathname;
      if (url.pathname.startsWith("/assets/usuarios/")) return url.pathname.replace("/assets/usuarios/", "/uploads/");
      // externo (ex.: YouTube/CDN) -> mantenha absoluto
      return url.toString();
    } catch {
      return s;
    }
  }

  // “uploads/arquivo.ext” sem barra
  if (s.startsWith("uploads/")) return `/${s}`;

  return s; // último recurso (não deve acontecer com o front novo)
}

function dataUrlToBuffer(dataUrl: string) {
  const m = /^data:(image|video)\/[a-z0-9+.-]+;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return Buffer.from(m[2], "base64");
}

export const postarConteudo = async (req: AuthedReq, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado." });

    const body = req.body as any;
    const file = (req as any).file as Express.Multer.File | undefined;

    const descricao: string | undefined = body.descricao ?? body.conteudo;
    const imagemUrl: string | undefined = body.imagemUrl;
    const videoUrl: string | undefined = body.videoUrl;

    let finalImagemUrl: string | null = null;
    let finalVideoUrl: string | null = null;

    // URLs vindas do front (http absoluto, /uploads ou legado /assets)
    if (isAllowedUrl(imagemUrl)) finalImagemUrl = normalizeIncomingUrl(imagemUrl!, req) || null;
    if (isAllowedUrl(videoUrl))  finalVideoUrl  = normalizeIncomingUrl(videoUrl!,  req) || null;

    // Upload de arquivo (campo "arquivo")
    if (!finalImagemUrl && !finalVideoUrl && file) {
      if (file.mimetype.startsWith("image/")) {
        finalImagemUrl = `/uploads/${file.filename}`;
      } else if (file.mimetype.startsWith("video/")) {
        finalVideoUrl = `/uploads/${file.filename}`;
      }
    }

    if (!descricao && !finalImagemUrl && !finalVideoUrl) {
      return res.status(400).json({ message: "Descrição ou mídia obrigatória." });
    }

    const tipoDetectado =
      finalVideoUrl ? "Video" : finalImagemUrl ? "Imagem" : "Documento";

    try {
      const post = await prisma.postagem.create({
        data: {
          usuarioId: req.userId!,
          conteudo: descricao || "",
          tipoMidia: tipoDetectado as any,
          imagemUrl: finalImagemUrl,
          videoUrl: finalVideoUrl,
          compartilhamentos: 0,
        },
        include: {
          usuario: { select: { id: true, nome: true, foto: true } },
          curtidas: true,
          comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
        },
      });
      return res.status(201).json(post);
    } catch (err: any) {
      if (err?.code === "P2002") {
        const existente = await prisma.postagem.findFirst({
          where: { usuarioId: req.userId!, conteudo: descricao || "" },
          include: {
            usuario: { select: { id: true, nome: true, foto: true } },
            curtidas: true,
            comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
          },
        });
        if (existente) return res.status(200).json(existente);
        return res.status(409).json({ message: "Você já postou esse mesmo conteúdo." });
      }
      throw err;
    }
  } catch (err) {
    console.error("postarConteudo error:", err);
    return res.status(500).json({ message: "Erro ao criar postagem." });
  }
};

export const adicionarComentario = async (req: AuthedReq, res: Response) => {
  const { postId } = req.params;
  const { conteudo } = req.body as { conteudo?: string };

  if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });
  if (!conteudo || !conteudo.trim())
    return res.status(400).json({ message: "Conteúdo do comentário é obrigatório" });

  try {
    const post = await prisma.postagem.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ message: "Postagem não encontrada." });

    const novoComentario = await prisma.comentario.create({
      data: {
        conteudo: conteudo.trim(),
        postagemId: postId,
        usuarioId: req.userId!,
      },
    });

    return res.status(201).json(novoComentario);
  } catch (error) {
    console.error("Erro ao adicionar comentário:", error);
    return res.status(500).json({ message: "Erro interno ao adicionar comentário" });
  }
};

export const editarPostagemGet = async (req: AuthedReq, res: Response) => {
  const { id } = req.params;
  try {
    const postagem = await prisma.postagem.findUnique({ where: { id } });
    if (!postagem || postagem.usuarioId !== req.userId) {
      return res.status(401).json({ message: "Você não tem permissão para editar esta postagem." });
    }
    return res.json(postagem);
  } catch {
    return res.status(500).json({ message: "Erro ao buscar postagem." });
  }
};

export const editarPostagemPost = async (req: AuthedReq, res: Response) => {
  const { id } = req.params;
  const { conteudo } = req.body;

  try {
    const postagem = await prisma.postagem.findUnique({ where: { id } });
    if (!postagem || postagem.usuarioId !== req.userId) {
      return res.status(401).json({ message: "Você não tem permissão para editar esta postagem." });
    }
    if (!conteudo) return res.status(400).json({ message: "O conteúdo não pode estar vazio." });

    await prisma.postagem.update({ where: { id }, data: { conteudo } });
    return res.json({ message: "Postagem atualizada com sucesso." });
  } catch {
    return res.status(500).json({ message: "Erro ao editar postagem." });
  }
};

export const deletarPost = async (req: AuthedReq, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Não autenticado." });
    const { id } = req.params;

    const post = await prisma.postagem.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ message: "Postagem não encontrada." });
    if (post.usuarioId !== req.userId) {
      return res.status(403).json({ message: "Você não pode apagar esta postagem." });
    }

    await prisma.$transaction([
      prisma.comentario.deleteMany({ where: { postagemId: id } }),
      prisma.curtida.deleteMany({ where: { postagemId: id } }),
      prisma.postagem.delete({ where: { id } }),
    ]);

    return res.status(204).send();
  } catch (e) {
    console.error("Erro ao deletar post:", e);
    return res.status(500).json({ message: "Erro ao apagar postagem." });
  }
};

export const buscarPostagemPorId = async (req: AuthedReq, res: Response) => {
  const { id } = req.params;
  try {
    const post = await prisma.postagem.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
        comentarios: {
          orderBy: { dataCriacao: "asc" },
          include: { usuario: { select: { id: true, nome: true, foto: true } } },
        },
        curtidas: { select: { usuarioId: true } },
      },
    });
    if (!post) return res.status(404).json({ message: "Postagem não encontrada." });
    return res.json(post);
  } catch (error) {
    console.error("Erro ao buscar postagem:", error);
    return res.status(500).json({ message: "Erro ao buscar postagem." });
  }
};

export const registrarCompartilhamento = async (req: AuthedReq, res: Response) => {
  const { postId } = req.params;
  try {
    const post = await prisma.postagem.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ message: "Postagem não encontrada." });

    await prisma.postagem.update({
      where: { id: postId },
      data: { compartilhamentos: { increment: 1 } },
    });

    return res.status(200).json({ message: "Compartilhamento registrado." });
  } catch (error) {
    console.error("Erro ao registrar compartilhamento:", error);
    return res.status(500).json({ message: "Erro ao registrar compartilhamento." });
  }
};

export const compartilharPostPorMensagem = async (req: AuthedReq, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Não autenticado." });
    const { postId } = req.params;
    const { paraIds, texto } = req.body as { paraIds?: string[]; texto?: string };

    if (!Array.isArray(paraIds) || paraIds.length === 0) {
      return res.status(400).json({ message: "Informe ao menos um destinatário em paraIds." });
    }

    const post = await prisma.postagem.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ message: "Postagem não encontrada." });

    const ops = paraIds
      .filter((id) => id && id !== req.userId)
      .map((paraId) =>
        prisma.mensagem.create({
          data: {
            deUsuarioId: req.userId!,
            paraUsuarioId: paraId,
            tipo: "POST",
            conteudo: postId,
            texto: texto ?? null,
          } as any,
        })
      );

    await prisma.$transaction(ops);

    await prisma.postagem.update({
      where: { id: postId },
      data: { compartilhamentos: { increment: ops.length } },
    });

    return res.json({ ok: true, enviados: ops.length });
  } catch (e) {
    console.error("compartilharPostPorMensagem:", e);
    return res.status(500).json({ message: "Erro ao compartilhar por mensagem." });
  }
};

export const repostarPost = async (req: AuthedReq, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Não autenticado." });
    const { postId } = req.params;
    const { comentario } = req.body as { comentario?: string };

    const original = await prisma.postagem.findUnique({ where: { id: postId } });
    if (!original) return res.status(404).json({ message: "Postagem original não encontrada." });

    const repost = await prisma.postagem.create({
      data: {
        usuarioId: req.userId,
        conteudo: comentario || "",
        tipoMidia: "Repost",
        imagemUrl: null,
        videoUrl: null,
      } as any,
    });

    await prisma.postagem.update({
      where: { id: original.id },
      data: { compartilhamentos: { increment: 1 } },
    });

    return res.status(201).json(repost);
  } catch (e) {
    console.error("repostarPost:", e);
    return res.status(500).json({ message: "Erro ao repostar." });
  }
};