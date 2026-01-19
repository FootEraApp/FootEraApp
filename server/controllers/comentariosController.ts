import { Response } from "express";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";


export async function criarComentario(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Usuário não autenticado" });

    const { postagemId, conteudo } = req.body as { postagemId?: string; conteudo?: string };

    if (!postagemId || !String(postagemId).trim()) {
      return res.status(400).json({ error: "postagemId é obrigatório" });
    }
    if (!conteudo || !String(conteudo).trim()) {
      return res.status(400).json({ error: "conteudo é obrigatório" });
    }

    const comentario = await prisma.comentario.create({
      data: {
        conteudo: String(conteudo).trim(),
        postagemId: String(postagemId),
        usuarioId: String(userId),
      },
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    return res.status(201).json(comentario);
  } catch (e) {
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