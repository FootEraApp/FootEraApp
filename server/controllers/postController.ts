import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sanitizeText, basicModerationFails, normalizeIncomingMediaUrl, MOD, isAllowedMime } from "../utils/moderation.js";
import { getIO } from "../socket.js"
import {
  VisibilidadePostagem,
} from "@prisma/client";

import {
  normalizarVisibilidadePostagem,
  podeVisualizarPostagem,
} from "../utils/postVisibility.js";

import {
  sanitizePublicPost,
} from "../utils/publicSanitizers.js";

type AuthedReq = Request & { userId?: string };

export const postarConteudo = async (req: AuthedReq, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado." });

    const body = req.body as any;
    const visibilidade =
      normalizarVisibilidadePostagem(
        body?.visibilidade,
        VisibilidadePostagem.LOGADO
      );

    const file = (req as any).file as Express.Multer.File | undefined;

    const rawDescricao: string | undefined = body.descricao ?? body.conteudo;
    const descricao = rawDescricao ? sanitizeText(rawDescricao, MOD.MAX_DESC_LEN) : undefined;

    if (descricao) {
      const fail = basicModerationFails(descricao);
      if (fail) return res.status(422).json({ message: fail });
    }

    const reqHost = String(req.headers.host || "");
    let finalImagemUrl: string | null =
      body.imagemUrl ? normalizeIncomingMediaUrl(body.imagemUrl, reqHost) || null : null;
    let finalVideoUrl: string | null =
      body.videoUrl ? normalizeIncomingMediaUrl(body.videoUrl, reqHost) || null : null;

    if (!finalImagemUrl && !finalVideoUrl && file) {
      if (!isAllowedMime(file.mimetype)) {
        return res.status(400).json({ message: "Arquivo com tipo não permitido." });
      }
      if (file.mimetype.startsWith("image/")) finalImagemUrl = `/uploads/${file.filename}`;
      else if (file.mimetype.startsWith("video/")) finalVideoUrl = `/uploads/${file.filename}`;
    }

    const descricaoBruta = body.descricao ?? body.conteudo ?? "";
    const conteudo = sanitizeText(descricaoBruta, MOD.MAX_DESC_LEN);
    {
      const fail = basicModerationFails(conteudo);
      if (fail) return res.status(422).json({ message: fail });
    }
    if (!descricao && !finalImagemUrl && !finalVideoUrl) {
      return res.status(400).json({ message: "Descrição ou mídia obrigatória." });
    }

    const tipoDetectado = finalVideoUrl ? "Video" : finalImagemUrl ? "Imagem" : "Documento";

    const post = await prisma.postagem.create({
      data: {
        usuarioId: req.userId!,
        conteudo: descricao || "",
        tipoMidia: tipoDetectado as any,
        imagemUrl: finalImagemUrl,
        videoUrl: finalVideoUrl,
        compartilhamentos: 0,
        visibilidade,
      },
      include: {
        usuario: { select: { id: true, nome: true, foto: true, tipo: true } },
        curtidas: true,
        comentarios: { include: { usuario: { select: { id: true, nome: true, foto: true } } } },
      },
    });

    try {
      const segs = await prisma.seguidor.findMany({
        where: { seguidoUsuarioId: req.userId! },
        select: { seguidorUsuarioId: true },
      });
      const rooms = [req.userId!, ...segs.map(s => s.seguidorUsuarioId)].map(id => `u:${id}`);
      const io = getIO();
      io?.to(rooms).emit("feed:novoPost", post);
    } catch (e) {
      console.warn("emit feed:novoPost falhou (não crítico):", e);
    }
    return res.status(201).json(post);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Você já postou esse mesmo conteúdo recentemente." });
    }
    console.error("postarConteudo error:", err);
    return res.status(500).json({ message: "Erro ao criar postagem." });
  }
};

export const adicionarComentario = async (req: AuthedReq, res: Response) => {
  const { postId } = req.params;
  const { conteudo } = req.body as { conteudo?: string };

  if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });

  const text = sanitizeText(conteudo || "", MOD.MAX_COMMENT_LEN);
  if (!text) return res.status(400).json({ message: "Conteúdo do comentário é obrigatório" });

  const bruto = (req.body.conteudo || "") as string;
  const texto = sanitizeText(bruto, MOD.MAX_COMMENT_LEN);
  const fail = basicModerationFails(texto);
  if (fail) return res.status(422).json({ message: fail });

  const post =
    await prisma.postagem.findUnique({
      where: {
        id: postId,
      },

      select: {
        id: true,
        usuarioId: true,
        visibilidade: true,
        oculto: true,
      },
    });

  if (!post) {
    return res.status(404).json({
      message:
        "Postagem não encontrada.",
    });
  }

  const permitido =
    await podeVisualizarPostagem(
      post,
      req.userId
    );

  if (!permitido) {
    return res.status(403).json({
      code: "POST_NOT_ACCESSIBLE",
      message:
        "Esta publicação não está disponível.",
    });
  }

  const novoComentario = await prisma.comentario.create({
    data: { conteudo: text, postagemId: postId, usuarioId: req.userId! },
  });

  return res.status(201).json(novoComentario);
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
  const raw = String(req.body?.conteudo ?? "");
  const conteudo = sanitizeText(raw, MOD.MAX_DESC_LEN);

  const postagem = await prisma.postagem.findUnique({ where: { id } });
  if (!postagem || postagem.usuarioId !== req.userId) {
    return res.status(401).json({ message: "Você não tem permissão para editar esta postagem." });
  }
  if (!conteudo) return res.status(400).json({ message: "O conteúdo não pode estar vazio." });

  const fail = basicModerationFails(conteudo);
  if (fail) return res.status(422).json({ message: fail });

  await prisma.postagem.update({ where: { id }, data: { conteudo } });
  return res.json({ message: "Postagem atualizada com sucesso." });
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

export const buscarPostagemPorId =
  async (
    req: AuthedReq,
    res: Response
  ) => {
    const { id } = req.params;

    try {
      const post =
        await prisma.postagem.findUnique({
          where: { id },

          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeDeUsuario: true,
                foto: true,
                tipo: true,
                verified: true,
                destaque: true,
              },
            },

            comentarios: {
              orderBy: {
                dataCriacao:
                  "asc",
              },

              include: {
                usuario: {
                  select: {
                    id: true,
                    nome: true,
                    nomeDeUsuario:
                      true,
                    foto: true,
                  },
                },
              },
            },

            curtidas: {
              select: {
                usuarioId:
                  true,
              },
            },
          },
        });

      if (!post) {
        return res
          .status(404)
          .json({
            message:
              "Postagem não encontrada.",
          });
      }

      const permitido =
        await podeVisualizarPostagem(
          post,
          req.userId
        );

      if (!permitido) {
        return res
          .status(403)
          .json({
            code:
              "POST_NOT_ACCESSIBLE",

            message:
              "Esta publicação não está disponível.",
          });
      }

      if (!req.userId) {
        return res.json(
          sanitizePublicPost(
            post
          )
        );
      }

      return res.json(post);
    } catch (error) {
      console.error(
        "Erro ao buscar postagem:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Erro ao buscar postagem.",
        });
    }
  };

export const registrarCompartilhamento = async (req: AuthedReq, res: Response) => {
  const { postId } = req.params;
  try {
    const post =
      await prisma.postagem.findUnique({
        where: {
          id: postId,
        },

        select: {
          id: true,
          usuarioId: true,
          visibilidade: true,
          oculto: true,
        },
      });

    if (!post) {
      return res.status(404).json({
        message:
          "Postagem não encontrada.",
      });
    }

    const permitido =
      await podeVisualizarPostagem(
        post,
        req.userId
      );

    if (!permitido) {
      return res.status(403).json({
        code:
          "POST_NOT_ACCESSIBLE",

        message:
          "Esta publicação não está disponível.",
      });
    }

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

    const post =
      await prisma.postagem.findUnique({
        where: {
          id: postId,
        },

        select: {
          id: true,
          usuarioId: true,
          visibilidade: true,
          oculto: true,
        },
      });

    if (!post) {
      return res.status(404).json({
        message:
          "Postagem não encontrada.",
      });
    }

    const permitido =
      await podeVisualizarPostagem(
        post,
        req.userId
      );

    if (!permitido) {
      return res.status(403).json({
        code:
          "POST_NOT_ACCESSIBLE",

        message:
          "Esta publicação não está disponível.",
      });
    }

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