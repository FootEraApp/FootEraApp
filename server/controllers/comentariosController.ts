import {
  Response,
} from "express";
import {
  z,
} from "zod";
import {
  NotificacaoTipo,
} from "@prisma/client";
import {
  prisma,
} from "../prisma.js";
import type {
  AuthenticatedRequest,
} from "../middlewares/auth.js";
import {
  podeVisualizarPostagem,
} from "../utils/postVisibility.js";
import {
  criarNotificacaoEEnviarPush,
} from "./notificacoesController.js";

const criarComentarioSchema = z.object({
  postagemId: z.string().trim().min(1, "postagemId é obrigatório"),
  conteudo: z
    .string()
    .trim()
    .min(1, "conteudo é obrigatório")
    .max(2000, "Comentário muito longo (máximo 2000 caracteres)"),
});

export async function criarComentario(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Usuário não autenticado" });

    const { postagemId, conteudo } = criarComentarioSchema.parse(req.body);

    const post =
      await prisma.postagem.findUnique({
        where: {
          id: postagemId,
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
          visibilidade: true,
          oculto: true,

          organizacao: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });

    if (!post) {
      return res
        .status(404)
        .json({
          error:
            "Postagem não encontrada.",
        });
    }

    const permitido =
      await podeVisualizarPostagem(
        post,
        userId
      );

    if (!permitido) {
      return res
        .status(403)
        .json({
          code:
            "POST_NOT_ACCESSIBLE",

          error:
            "Esta publicação não está disponível.",
        });
    }

    const comentario = await prisma.comentario.create({
      data: {
        conteudo,
        postagemId,
        usuarioId: String(userId),
      },
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    if (
      String(post.usuarioId) !==
      String(userId)
    ) {
      try {
        const nomeOrganizacao =
          String(
            post.organizacao?.nome ??
            ""
          ).trim();

        const mensagem =
          nomeOrganizacao
            ? `A publicação da ${nomeOrganizacao} recebeu um novo comentário.`
            : "Sua publicação recebeu um novo comentário.";

        await criarNotificacaoEEnviarPush({
          usuarioId:
            post.usuarioId,

          actorId:
            String(userId),

          tipo:
            NotificacaoTipo.GENERICA,

          titulo:
            "Novo comentário",

          mensagem,

          link:
            `/post/${encodeURIComponent(
              postagemId
            )}`,
        });
      } catch (error) {
        /*
        * O comentário já existe.
        * Não transformamos falha de push
        * em falha de comentário.
        */
        console.warn(
          "[criarComentario] falha ao criar notificação:",
          error
        );
      }
    }

    return res.status(201).json(comentario);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return res.status(400).json({ error: "Dados inválidos.", details: e.errors });
    }
    console.error("Erro ao criar comentário:", e);
    return res.status(500).json({ error: "Erro interno ao comentar" });
  }
}

export async function deletarComentario(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: "Não autenticado" });

    const id = String((req.params as any).comentarioId || req.params.id || "");
    const row = await prisma.comentario.findUnique({ where: { id } });

    if (!row) return res.status(404).json({ error: "Comentário não encontrado" });
    if (String(row.usuarioId) !== String(req.userId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    await prisma.comentario.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao apagar comentário" });
  }
}